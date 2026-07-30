package expo.modules.modelintegrity

import android.system.Os
import android.system.OsConstants
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.URI
import java.security.MessageDigest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class ModelIntegrityModule : Module() {
  private fun modelsRoot(): File {
    val reactContext = appContext.reactContext
      ?: error("React context is unavailable")
    val documentsRoot = reactContext.filesDir.canonicalFile
    val modelsRoot = File(reactContext.filesDir, "models")
    require(modelsRoot.parentFile?.canonicalFile == documentsRoot) {
      "Models root must stay inside app files storage"
    }
    val canonicalModelsRoot = modelsRoot.canonicalFile
    require(modelsRoot.absolutePath == canonicalModelsRoot.path) {
      "Models root must not be a symbolic link"
    }
    return canonicalModelsRoot
  }

  private fun confinedArtifact(uri: String): File {
    val parsedUri = URI(uri)
    require(parsedUri.scheme == "file" && parsedUri.host == null) {
      "Only local file:// model artifacts are supported"
    }
    require(parsedUri.query == null && parsedUri.fragment == null) {
      "Model artifact URI must not have a query or fragment"
    }

    val root = modelsRoot()
    val artifact = File(parsedUri).canonicalFile
    val modelsPrefix = root.path + File.separator
    require(artifact.path == root.path || artifact.path.startsWith(modelsPrefix)) {
      "Model artifact must stay inside the app models directory"
    }
    return artifact
  }

  private fun sha256(file: File): String {
    require(file.isFile) { "Model artifact does not exist or is not a file" }
    val messageDigest = MessageDigest.getInstance("SHA-256")
    val buffer = ByteArray(1048576)
    FileInputStream(file).use { input ->
      while (true) {
        val bytesRead = input.read(buffer)
        if (bytesRead < 0) break
        if (bytesRead > 0) messageDigest.update(buffer, 0, bytesRead)
      }
    }
    return messageDigest.digest().joinToString("") { byte -> "%02x".format(byte) }
  }

  private fun verifyArtifact(file: File, expectedBytes: Long, expectedSha256: String) {
    require(file.isFile) { "Model artifact does not exist or is not a file" }
    require(file.length() == expectedBytes) { "Model artifact size does not match" }
    require(sha256(file) == expectedSha256) { "Model artifact SHA-256 does not match" }
  }

  private fun syncFile(file: File) {
    FileOutputStream(file, true).use { output -> output.fd.sync() }
  }

  private fun syncDirectory(directory: File) {
    val descriptor = Os.open(
      directory.path,
      OsConstants.O_RDONLY or OsConstants.O_DIRECTORY,
      0
    )
    try {
      Os.fsync(descriptor)
    } finally {
      Os.close(descriptor)
    }
  }

  private fun restoreBackup(backup: File, completed: File, parent: File) {
    if (completed.exists()) require(completed.delete()) { "Could not remove failed replacement" }
    Os.rename(backup.path, completed.path)
    syncDirectory(parent)
  }

  private fun replaceVerified(
    partial: File,
    completed: File,
    expectedBytes: Long,
    expectedSha256: String
  ) {
    require(expectedBytes > 0) { "Expected model size must be positive" }
    require(Regex("^[a-f0-9]{64}$").matches(expectedSha256)) {
      "Expected SHA-256 is malformed"
    }
    require(partial.parentFile?.canonicalFile == completed.parentFile?.canonicalFile) {
      "Partial and completed artifacts must share a directory"
    }
    val parent = completed.parentFile ?: error("Model artifact parent is unavailable")
    require(parent.isDirectory) { "Model artifact directory does not exist" }
    require(Os.stat(partial.path).st_dev == Os.stat(parent.path).st_dev) {
      "Replacement must remain on one filesystem"
    }

    verifyArtifact(partial, expectedBytes, expectedSha256)
    val backup = confinedArtifact(completed.toURI().toString() + ".backup")

    if (backup.exists()) {
      if (!completed.exists()) {
        restoreBackup(backup, completed, parent)
      } else {
        try {
          verifyArtifact(completed, expectedBytes, expectedSha256)
          require(partial.delete()) { "Could not remove redundant partial artifact" }
          require(backup.delete()) { "Could not remove stale backup artifact" }
          syncDirectory(parent)
          return
        } catch (_: Throwable) {
          restoreBackup(backup, completed, parent)
        }
      }
    }

    syncFile(partial)
    syncDirectory(parent)
    var backupCreated = false
    try {
      if (completed.exists()) {
        Os.rename(completed.path, backup.path)
        backupCreated = true
        syncDirectory(parent)
      }
      Os.rename(partial.path, completed.path)
      syncFile(completed)
      syncDirectory(parent)
      verifyArtifact(completed, expectedBytes, expectedSha256)
      if (backupCreated) {
        require(backup.delete()) { "Could not remove replacement backup" }
        syncDirectory(parent)
      }
    } catch (error: Throwable) {
      if (backupCreated && backup.exists()) {
        restoreBackup(backup, completed, parent)
      } else if (completed.exists()) {
        completed.delete()
        syncDirectory(parent)
      }
      throw error
    }
  }

  override fun definition() = ModuleDefinition {
    Name("ModelIntegrity")

    AsyncFunction("sha256") Coroutine { uri: String ->
      withContext(Dispatchers.IO) {
        sha256(confinedArtifact(uri))
      }
    }

    AsyncFunction("assertModelPath") Coroutine { uri: String ->
      withContext(Dispatchers.IO) {
        confinedArtifact(uri)
        Unit
      }
    }

    AsyncFunction("replaceVerified") Coroutine {
      partialUri: String,
      completedUri: String,
      expectedBytes: Long,
      expectedSha256: String ->
      withContext(Dispatchers.IO) {
        val partial = confinedArtifact(partialUri)
        val completed = confinedArtifact(completedUri)
        replaceVerified(partial, completed, expectedBytes, expectedSha256)
      }
    }
  }
}
