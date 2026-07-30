package expo.modules.modelintegrity

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileInputStream
import java.net.URI
import java.security.MessageDigest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class ModelIntegrityModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ModelIntegrity")

    AsyncFunction("sha256") Coroutine { uri: String ->
      withContext(Dispatchers.IO) {
        val parsedUri = URI(uri)
        require(parsedUri.scheme == "file") { "Only file:// model artifacts can be hashed" }

        val reactContext = appContext.reactContext
          ?: error("React context is unavailable")
        val documentsRoot = reactContext.filesDir.canonicalFile
        val artifact = File(parsedUri).canonicalFile
        val documentsPrefix = documentsRoot.path + File.separator

        require(
          artifact.path == documentsRoot.path || artifact.path.startsWith(documentsPrefix)
        ) { "Model artifact must be inside app-specific documents storage" }
        require(artifact.isFile) { "Model artifact does not exist or is not a file" }

        val messageDigest = MessageDigest.getInstance("SHA-256")
        val buffer = ByteArray(1048576)
        FileInputStream(artifact).use { input ->
          while (true) {
            val bytesRead = input.read(buffer)
            if (bytesRead < 0) break
            if (bytesRead > 0) {
              messageDigest.update(buffer, 0, bytesRead)
            }
          }
        }
        messageDigest.digest().joinToString("") { byte -> "%02x".format(byte) }
      }
    }
  }
}
