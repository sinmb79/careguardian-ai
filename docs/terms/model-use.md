# 로컬 AI 모델 이용 약관 및 고지

이 약관은 생활후견 AI의 비공개 테스트에서 사용자가 기기에 설치하는 제3자 로컬 AI 모델에 적용됩니다. 본문은 한국어 안내이며, 법적 원문은 앱에 포함된 라이선스 전문과 고정된 공식 출처를 우선합니다.

## 1. 적용 모델과 원문 열람

NAVER HyperCLOVA X SEED 모델을 설치하기 전 사용자는 앱 내의 다음 원문을 열람하고 동의해야 합니다.

- `assets/model-licenses/hyperclovax-seed/LICENSE.txt` — [영문 원문 LICENSE (0.5B)](https://huggingface.co/naver-hyperclovax/HyperCLOVAX-SEED-Text-Instruct-0.5B/resolve/3da5046fb0195d14f2497de198136987d35fd644/LICENSE), [영문 원문 LICENSE (1.5B)](https://huggingface.co/naver-hyperclovax/HyperCLOVAX-SEED-Text-Instruct-1.5B/resolve/0728a47d632019a8da5f53b663db1c175dc04115/LICENSE)
- `assets/model-licenses/hyperclovax-seed/NOTICE.txt` — LICENSE §3.1(iv)의 필수 고지 문구
- `assets/model-licenses/hyperclovax-seed/PROHIBITED_USE_POLICY.txt` — LICENSE §2.3의 영문 원문

해당 파일은 오프라인에서도 열람 가능해야 합니다. NAVER 모델 화면과 NAVER 모델의 AI 결과 화면에는 항상 `Powered by HyperCLOVA X`를 표시해야 합니다.

## 2. 금지 사용 정책 — 구속력 있는 조항

NAVER HyperCLOVA X SEED 모델 또는 파생 모델의 사용·배포를 규율하는 본 약관에는 LICENSE §2.3 Prohibited Use Policy가 구속력 있는 조항으로 포함됩니다. 사용자는 적용 법령을 위반하는 목적으로 모델·서비스를 이용해서는 안 됩니다. 여기에는 불법 감시, 법령상 동의가 필요한 생체정보의 불법 수집·처리, 개인 또는 집단에 대한 불법 괴롭힘·학대·위협·따돌림, 타인을 의도적으로 오도하거나 기만하는 행위가 포함되며 이에 한정되지 않습니다.

사용자는 제품·서비스가 관련 산업 또는 사용 사례의 법적·윤리적 요건을 충족하도록 하고, 의도하지 않은 편향과 특히 소외되거나 취약한 집단에 대한 피해를 완화할 합리적 조치를 취하며, 사용자에게 제품·서비스의 성격과 한계를 알려야 합니다. 정확한 영문 문구는 앱에 포함된 [§2.3 원문](../model-supply-chain.md#라이선스-원문-및-출처)을 따릅니다.

## 3. 재배포와 표시

NAVER 모델 또는 파생 모델을 복제·배포·제공하는 경우 LICENSE §3.1의 조건을 준수해야 합니다. 특히 다음을 이행해야 합니다.

- 본 금지 사용 정책과 후속 사용자 고지를 사용·배포 약관에 구속력 있게 포함합니다.
- 수령자에게 라이선스 전문 사본을 제공합니다.
- 수정 파일에는 수정 사실을 눈에 띄게 표시합니다.
- NOTICE 문구를 포함하고 `Powered by HyperCLOVA X`를 관련 웹사이트·UI·블로그·소개 페이지·제품 문서에 눈에 띄게 표시합니다.

이 한국어 설명은 LICENSE 원문을 대체하거나 범위를 축소하지 않습니다.

## 4. 10M MAU 및 직접 경쟁 서비스 게이트

LICENSE §4에 따라 모델 공개일 기준 직전 월에 라이선스 이용자 또는 그 계열사의 제품·서비스 월간 활성 사용자가 1,000만 명을 초과하거나, NAVER가 제공하는 제품·서비스와 실질적으로 유사하거나 직접 경쟁하는 제품·서비스를 제공·배포하는 경우 NAVER에 별도 라이선스를 요청해야 합니다. NAVER가 명시적으로 권리를 부여하기 전에는 이 라이선스에 따른 권리를 행사할 수 없습니다.

이 조건에 해당할 가능성이 있는 조직은 설치·배포·상용화 전에 별도 라이선스 확인을 완료해야 합니다.

## 5. Kakao Kanana 후보

Kanana 1.5 2.1B Instruct는 [Apache-2.0 원문](https://huggingface.co/kakaocorp/kanana-1.5-2.1b-instruct-2505/resolve/7df4bc35ccd610e451809d7106e1c3cf82bfd44c/LICENSE)을 앱에 보관합니다. 다만 승인된 GGUF가 없으므로 현 비공개 테스트에서는 `blocked_no_approved_gguf` 상태로 표시만 하며, 다운로드·설치할 수 없습니다.

## 6. 개인정보와 책임

로컬 AI 기능은 기기 안의 개인 작업공간을 보조하기 위한 기능입니다. 실제 개인·건강·복약 데이터는 현재 비공개 테스트의 NO-GO 범위이며, 사용자는 모델 출력의 적절성과 후속 사용에 대한 책임을 집니다. 이 약관은 법률 자문이 아닙니다.
