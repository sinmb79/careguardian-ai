# 로컬 AI 모델 공급망

이 문서는 비공개 테스트에서 표시하거나 설치할 수 있는 한국어 로컬 모델의 고정된 공급망 기록입니다. 모델 가중치는 이 저장소에 포함하거나 이 검증 과정에서 다운로드하지 않았습니다.

## 설치 승인 모델

| 모델 | 고정 GGUF 저장소와 리비전 | 파일 | 크기 | SHA-256 | 최소 RAM | 앱 기본 문맥 | Hub GGUF 공식 문맥 |
| --- | --- | --- | ---: | --- | ---: | ---: | ---: |
| HyperCLOVA X SEED Text Instruct 0.5B Q4_K_M | `naver-ellm/HyperCLOVAX-SEED-Text-Instruct-0.5B-GGUF@27831169fdebe6fe30bb1b9d76b12a2d06693f26` | `HyperCLOVAX-SEED-Text-Instruct-0.5B-Q4_K_M.gguf` | 431,882,784 bytes | `bc6a93b452648e8e90b06dc04f81edbdce9703fa76bdf589a63cc8418699d44f` | 4GB | 2,048 | 8,192 |
| HyperCLOVA X SEED Text Instruct 1.5B Q4_K_M | `naver-ellm/HyperCLOVAX-SEED-Text-Instruct-1.5B-GGUF@b9bbb68d6635a8b80263bf7165c8b908d64f28de` | `HyperCLOVAX-SEED-Text-Instruct-1.5B-Q4_K_M.gguf` | 1,006,572,160 bytes | `6e0841f886f55411327d4659308f2408424f0ac55a2d32f60a49f470c71381a6` | 6GB | 4,096 | 131,072 |

다운로드 URL은 레지스트리에서 `https://huggingface.co/<repo>/resolve/<immutable-revision>/<artifact>?download=true` 형식만 허용합니다. `main`·태그·가변 URL은 설치 대상에 사용할 수 없습니다. 설치 전에는 bytes와 SHA-256을 모두 검증해야 합니다.

### 설계와 공식 메타데이터의 문맥 차이

초기 설계 §7은 최대 문맥을 0.5B=4,096, 1.5B=16,384으로 기록했습니다. 2026-07-30에 `hf` CLI 1.8.0으로 고정 GGUF 정보를 다시 확인한 결과는 0.5B=8,192, 1.5B=131,072입니다. 이 차이를 감추거나 설계 값을 공식 GGUF 값으로 표기하지 않습니다. 앱은 메모리·지연시간 관리 목적의 보수적인 기본값 2,048/4,096만 사용하며, `officialModelContextTokens`에는 Hub GGUF 메타데이터 값을 기록합니다. 실제 런타임은 기기 메모리와 엔진의 지원 한도를 추가로 확인해야 합니다.

## 표시만 하는 후보

| 모델 | 고정 원본 저장소와 리비전 | 라이선스 | 상태 |
| --- | --- | --- | --- |
| Kanana 1.5 2.1B Instruct | `kakaocorp/kanana-1.5-2.1b-instruct-2505@7df4bc35ccd610e451809d7106e1c3cf82bfd44c` | Apache-2.0 | `blocked_no_approved_gguf` |

고정 Kakao 저장소에는 Transformers/safetensors 가중치만 있으며 공식 승인 GGUF가 없습니다. 따라서 이 항목에는 다운로드 URL·파일명·크기·SHA-256을 기록하거나 제공하지 않습니다. 공식 GGUF 또는 원본 가중치에서 재현 가능하고 내부 승인된 변환본의 고정 리비전·크기·SHA-256이 마련될 때까지 다운로드 버튼은 비활성 상태여야 합니다.

## 라이선스 원문 및 출처

NAVER의 GGUF 배포 저장소 모델 카드가 가리키는 원본(base model)은 `naver-hyperclovax`입니다. 다음은 2026-07-30에 확인해 고정한 공식 원문 출처입니다.

| 원문 | 0.5B 원본 모델 고정 리비전 | 1.5B 원본 모델 고정 리비전 | 앱 내 사본 |
| --- | --- | --- | --- |
| HyperCLOVA X SEED Model License Agreement | [LICENSE@3da5046fb0195d14f2497de198136987d35fd644](https://huggingface.co/naver-hyperclovax/HyperCLOVAX-SEED-Text-Instruct-0.5B/resolve/3da5046fb0195d14f2497de198136987d35fd644/LICENSE) | [LICENSE@0728a47d632019a8da5f53b663db1c175dc04115](https://huggingface.co/naver-hyperclovax/HyperCLOVAX-SEED-Text-Instruct-1.5B/resolve/0728a47d632019a8da5f53b663db1c175dc04115/LICENSE) | `apps/mobile/assets/model-licenses/hyperclovax-seed/LICENSE.txt` |
| Section 3.1(iv) NOTICE 문구 | 위 LICENSE §3.1(iv) | 위 LICENSE §3.1(iv) | `apps/mobile/assets/model-licenses/hyperclovax-seed/NOTICE.txt` |
| Section 2.3 Prohibited Use Policy | 위 LICENSE §2.3 | 위 LICENSE §2.3 | `apps/mobile/assets/model-licenses/hyperclovax-seed/PROHIBITED_USE_POLICY.txt` |

두 고정 원본 모델 저장소의 sibling 목록에는 `LICENSE`만 존재합니다. 별도 `NOTICE`나 `PROHIBITED_USE_POLICY` 파일이 있다고 추정하지 않았습니다. 앱의 NOTICE는 LICENSE §3.1(iv)가 요구하는 문구를 그대로 옮긴 것이며, 금지 사용 정책 파일은 LICENSE §2.3 원문을 그대로 추출한 것입니다. 둘 다 요약이나 재작성으로 대체하지 않았습니다.

Kanana Apache-2.0 원문은 [LICENSE@7df4bc35ccd610e451809d7106e1c3cf82bfd44c](https://huggingface.co/kakaocorp/kanana-1.5-2.1b-instruct-2505/resolve/7df4bc35ccd610e451809d7106e1c3cf82bfd44c/LICENSE)에서 확보해 `apps/mobile/assets/model-licenses/apache-2.0/LICENSE.txt`에 보관했습니다.

## 공식 검증 명령

```powershell
hf --version
hf models info naver-ellm/HyperCLOVAX-SEED-Text-Instruct-0.5B-GGUF
hf models info naver-ellm/HyperCLOVAX-SEED-Text-Instruct-1.5B-GGUF
hf download --dry-run naver-ellm/HyperCLOVAX-SEED-Text-Instruct-0.5B-GGUF HyperCLOVAX-SEED-Text-Instruct-0.5B-Q4_K_M.gguf --revision 27831169fdebe6fe30bb1b9d76b12a2d06693f26
hf download --dry-run naver-ellm/HyperCLOVAX-SEED-Text-Instruct-1.5B-GGUF HyperCLOVAX-SEED-Text-Instruct-1.5B-Q4_K_M.gguf --revision b9bbb68d6635a8b80263bf7165c8b908d64f28de
hf models info kakaocorp/kanana-1.5-2.1b-instruct-2505
```

`--dry-run`은 파일을 내려받지 않고 크기만 확인합니다. Hub API와 `hf models info`의 현재 SHA는 공개 저장소가 변경될 수 있으므로, 설치 허용 판단은 반드시 위 표의 고정 GGUF 리비전과 무결성 값으로 합니다.
