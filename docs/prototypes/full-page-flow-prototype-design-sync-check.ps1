param(
  [string]$PrototypeDirectory = $PSScriptRoot,
  [switch]$Finalize
)

$ErrorActionPreference = 'Stop'
$contextName = 'full-page-flow-prototype-design-context.md'
$stateName = 'full-page-flow-prototype-design-sync-state.json'
$contextPath = Join-Path $PrototypeDirectory $contextName
$statePath = Join-Path $PrototypeDirectory $stateName
$failures = [System.Collections.Generic.List[string]]::new()

function Read-Utf8([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) {
    return $null
  }
  return Get-Content -LiteralPath $Path -Raw -Encoding UTF8
}

function Add-Failure([string]$Message) {
  $script:failures.Add($Message)
}

function Match-One([string]$Contents, [string]$Pattern, [string]$Label) {
  $matches = [regex]::Matches($Contents, $Pattern)
  if ($matches.Count -ne 1) {
    Add-Failure "$Label : 정확히 1개여야 하나 $($matches.Count)개"
    return $null
  }
  return $matches[0]
}

function Get-Sha256([string]$Contents) {
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    # 봉인 상태와 텍스트 증거는 checkout 줄끝이 아니라 논리 내용을 잰다.
    $normalized = $Contents.Replace("`r`n", "`n")
    $bytes = [System.Text.UTF8Encoding]::new($false).GetBytes($normalized)
    return ([System.BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
  }
  finally {
    $sha.Dispose()
  }
}

function Get-NormalizedTextSha256([string]$Contents) {
  # 생성기가 LF 텍스트로 기록한 증거는 checkout OS가 아니라 논리 내용을 잰다.
  return Get-Sha256 ($Contents.Replace("`r`n", "`n"))
}

if (-not (Test-Path -LiteralPath $contextPath)) {
  Write-Error 'FAIL: 디자인 맥락 장부가 없습니다.'
}

$context = Read-Utf8 $contextPath
$idMatch = Match-One $context '(?m)^> 현재 동기화 ID:\s*`(?<value>DS-\d{8}-\d{3})`\s*$' '맥락 장부 현재 동기화 ID'
$statusMatch = Match-One $context '(?m)^> 문서 동기화 상태:\s*`(?<value>IN_PROGRESS|SYNCED)`\s*$' '맥락 장부 문서 동기화 상태'
$overallMatch = Match-One $context '(?m)^> 전체 UI 작업 상태:\s*`(?<value>IN_PROGRESS|COMPLETE)`\s*$' '맥락 장부 전체 UI 작업 상태'
$commonMatch = Match-One $context '(?m)^> 공통 변경:\s*`(?<value>예|아니오)`\s*$' '맥락 장부 공통 변경'
$uiMatch = Match-One $context '(?m)^> UI 변경:\s*`(?<value>예|아니오)`\s*$' '맥락 장부 UI 변경'
$prtMatch = Match-One $context '(?m)^> 변경 기록:\s*`(?<value>PRT-\d+)`\s*$' '맥락 장부 변경 기록'

if ($failures.Count -gt 0) {
  Write-Output 'DESIGN DOC SYNC: FAIL (맥락 장부 형식)'
  $failures | ForEach-Object { Write-Output "- $_" }
  exit 1
}

$syncId = $idMatch.Groups['value'].Value
$syncStatus = $statusMatch.Groups['value'].Value
$overallStatus = $overallMatch.Groups['value'].Value
$commonChange = $commonMatch.Groups['value'].Value
$uiChange = $uiMatch.Groups['value'].Value
$prtId = $prtMatch.Groups['value'].Value
$idDate = [datetime]::ParseExact($syncId.Substring(3, 8), 'yyyyMMdd', [Globalization.CultureInfo]::InvariantCulture).ToString('yyyy-MM-dd')

if ($syncStatus -ne 'SYNCED') {
  Add-Failure "$contextName : 문서 동기화 상태가 SYNCED가 아님 ($syncStatus)"
}
if ($overallStatus -eq 'COMPLETE' -and $context -notmatch '(?m)^- 전체 화면 전수 검수:\s*PASS\s*$') {
  Add-Failure "$contextName : 전체 UI 완료 근거가 없음"
}
if ($context -notmatch ('(?m)^###\s+' + [regex]::Escape($syncId) + '\s+·\s+.+$')) {
  Add-Failure "$contextName : 가장 최근 작업 제목에 현재 ID가 없음"
}
if ($context -notmatch '(?m)^- 다음 시작점:\s*.+$') {
  Add-Failure "$contextName : 다음 시작점 누락"
}

$required = [ordered]@{
  '0_full-page-flow-prototype-ui-applied.html' = 'html'
  'full-page-flow-prototype-current-spec.md' = 'spec'
  'full-page-flow-prototype-changelog.md' = 'changelog'
  '0_full-page-flow-prototype-ui-applied-review.md' = 'review'
  $contextName = 'context'
}
if ($commonChange -eq '예') {
  $required['full-page-flow-prototype-ui-guide.md'] = 'guide'
  $required['full-page-flow-prototype-design-work-plan.md'] = 'plan'
}

$contentsByFile = [ordered]@{}
foreach ($fileName in $required.Keys) {
  $filePath = Join-Path $PrototypeDirectory $fileName
  $contents = Read-Utf8 $filePath
  if ($null -eq $contents) {
    Add-Failure "$fileName : 파일 없음"
    continue
  }
  $contentsByFile[$fileName] = $contents
}

if ($contentsByFile.Contains('0_full-page-flow-prototype-ui-applied.html')) {
  $html = $contentsByFile['0_full-page-flow-prototype-ui-applied.html']
  $marker = Match-One $html ('(?m)^<!-- DESIGN_SYNC:\s*' + [regex]::Escape($syncId) + '\s*-->\s*$') 'UI 적용본 상단 marker'
  if ($null -ne $marker) {
    $lineNumber = ($html.Substring(0, $marker.Index) -split "`n").Count
    if ($lineNumber -gt 5) { Add-Failure "UI 적용본 marker : 첫 5줄 밖에 있음 ($lineNumber 줄)" }
  }
}

if ($contentsByFile.Contains('full-page-flow-prototype-current-spec.md')) {
  $null = Match-One $contentsByFile['full-page-flow-prototype-current-spec.md'] ('(?m)^- 현재 디자인 동기화 ID:\s*`' + [regex]::Escape($syncId) + '`\s*$') '현재 확정안 header ID'
}

if ($contentsByFile.Contains('full-page-flow-prototype-changelog.md')) {
  $changelog = $contentsByFile['full-page-flow-prototype-changelog.md']
  $historyIndex = $changelog.IndexOf('## 변경 내역')
  if ($historyIndex -lt 0) {
    Add-Failure '변경 기록 : 변경 내역 절 없음'
  }
  else {
    $history = $changelog.Substring($historyIndex)
    $firstPrt = [regex]::Match($history, '(?m)^###\s+(?<prt>PRT-\d+)\s+·\s+(?<date>\d{4}-\d{2}-\d{2}).*$')
    if (-not $firstPrt.Success) {
      Add-Failure '변경 기록 : 최신 PRT 제목을 찾지 못함'
    }
    else {
      if ($firstPrt.Groups['prt'].Value -ne $prtId) { Add-Failure "변경 기록 : 최신 PRT가 $prtId 아님 ($($firstPrt.Groups['prt'].Value))" }
      if ($firstPrt.Groups['date'].Value -ne $idDate) { Add-Failure '변경 기록 : 최신 PRT 날짜와 동기화 ID 날짜 불일치' }
      $blockStart = $firstPrt.Index
      $nextPrt = [regex]::Match($history.Substring($blockStart + $firstPrt.Length), '(?m)^###\s+PRT-\d+\s+·')
      $blockLength = if ($nextPrt.Success) { $firstPrt.Length + $nextPrt.Index } else { $history.Length - $blockStart }
      $latestBlock = $history.Substring($blockStart, $blockLength)
      if ($latestBlock -notmatch ('(?m)^- 디자인 동기화 ID:\s*`' + [regex]::Escape($syncId) + '`\s*$')) {
        Add-Failure "변경 기록 : 최신 $prtId 블록에 $syncId 없음"
      }
    }
  }
}

if ($contentsByFile.Contains('0_full-page-flow-prototype-ui-applied-review.md')) {
  $review = $contentsByFile['0_full-page-flow-prototype-ui-applied-review.md']
  $reviewHeading = [regex]::Match($review, ('(?m)^##\s+' + [regex]::Escape($syncId) + '\s+·\s+.+$'))
  if (-not $reviewHeading.Success) {
    Add-Failure '검수 기록 : 현재 ID 절 없음'
  }
  else {
    $afterHeading = $review.Substring($reviewHeading.Index + $reviewHeading.Length)
    $nextHeading = [regex]::Match($afterHeading, '(?m)^##\s+')
    $reviewBlock = if ($nextHeading.Success) { $afterHeading.Substring(0, $nextHeading.Index) } else { $afterHeading }
    foreach ($field in @('대상', '기대값', '실제값', 'PC 검수', '모바일 검수', '미검수', '결과', '증거')) {
      if ($reviewBlock -notmatch ('(?m)^- ' + [regex]::Escape($field) + ':\s*\S.+$')) {
        Add-Failure "검수 기록 : $field 필드 누락"
      }
    }
    if ($reviewBlock -notmatch '(?ms)^- PC 검수:.*?\bPASS\b\s*(?=^- |\z)') { Add-Failure '검수 기록 : PC PASS 누락' }
    if ($reviewBlock -notmatch '(?ms)^- 모바일 검수:.*?\bPASS\b\s*(?=^- |\z)') { Add-Failure '검수 기록 : 모바일 PASS 누락' }
    if ($reviewBlock -notmatch '(?m)^- 미검수:\s*없음\s*$') { Add-Failure '검수 기록 : 미검수 항목이 남아 있음' }
    if ($reviewBlock -notmatch '(?m)^- 결과:\s*PASS\s*$') { Add-Failure '검수 기록 : 최종 PASS 누락' }
  }
}

if ($commonChange -eq '예') {
  if ($contentsByFile.Contains('full-page-flow-prototype-ui-guide.md')) {
    $null = Match-One $contentsByFile['full-page-flow-prototype-ui-guide.md'] ('(?m)^- 현재 디자인 동기화 ID:\s*`' + [regex]::Escape($syncId) + '`\s*$') 'UI 가이드 header ID'
  }
  if ($contentsByFile.Contains('full-page-flow-prototype-design-work-plan.md')) {
    $null = Match-One $contentsByFile['full-page-flow-prototype-design-work-plan.md'] ('(?m)^> 현재 디자인 동기화 ID:\s*`' + [regex]::Escape($syncId) + '`\s*$') '디자인 실행서 header ID'
  }
}

# --- 렌더 감사 증거 결속 (PRT-188) ---
# 문서에 적는 렌더 산출물 분포와 뷰포트 회귀 수치는 render-audit 스크립트의 출력에서만 인용한다.
# 이 검사는 DOM 을 다시 재지 않는다(그것은 node+playwright 가 필요하다).
# 보존된 결과 JSON 이 "지금 이 적용본, 지금 이 동기화 ID" 에 묶여 있는지를 확인한다.
# 적용본이 바뀌면 증거가 자동으로 무효가 되므로, 낡은 측정값을 그대로 인용할 수 없다.
$auditName = 'full-page-flow-prototype-render-audit.json'
$auditScriptName = 'full-page-flow-prototype-render-audit.mjs'
$auditPath = Join-Path $PrototypeDirectory $auditName
$auditScriptPath = Join-Path $PrototypeDirectory $auditScriptName
if (-not (Test-Path -LiteralPath $auditPath)) {
  Add-Failure "$auditName : 렌더 감사 결과가 없음"
}
elseif (-not (Test-Path -LiteralPath $auditScriptPath)) {
  Add-Failure "$auditScriptName : 렌더 감사 스크립트가 없음"
}
else {
  $audit = Read-Utf8 $auditPath | ConvertFrom-Json
  # 적용본 manifest는 이 저장소의 봉인 바이트 SHA를 사용한다. 반면 JS/JSON 증거는
  # 생성기가 LF 텍스트로 기록하므로 아래 Get-Sha256 정규형으로 비교한다.
  $appliedSha = Get-NormalizedTextSha256 (Read-Utf8 (Join-Path $PrototypeDirectory '0_full-page-flow-prototype-ui-applied.html'))
  $auditScriptSha = Get-NormalizedTextSha256 (Read-Utf8 $auditScriptPath)
  if ($audit.manifest.target.sha256 -ne $appliedSha) {
    Add-Failure "$auditName : 적용본 SHA 불일치. 감사=$($audit.manifest.target.sha256) 현재=$appliedSha. 재측정 필요"
  }
  if ($audit.manifest.target.designSyncId -ne $syncId) {
    Add-Failure "$auditName : 동기화 ID 불일치. 감사=$($audit.manifest.target.designSyncId) 현재=$syncId"
  }
  if ($audit.manifest.script.sha256 -ne $auditScriptSha) {
    Add-Failure "$auditName : 측정 스크립트 SHA 불일치. 감사=$($audit.manifest.script.sha256) 현재=$auditScriptSha"
  }
  # 결과 자체가 계약을 만족하는지 단언한다 (PRT-189).
  # 결속만 맞고 내용이 실패인 JSON 도 -Finalize 되던 구멍을 막는다.
  $s = $audit.summary
  if ($s.targetsMeasured -lt 1) { Add-Failure "$auditName : 측정 target 이 없음" }
  if ($s.duplicateTargets -ne 0) { Add-Failure "$auditName : target 중복 $($s.duplicateTargets)건" }
  if ($s.activeTargets + $s.hiddenTargets -ne $s.targetsMeasured) {
    Add-Failure "$auditName : 산식 불일치 활성 $($s.activeTargets) + 숨김 $($s.hiddenTargets) != 측정 $($s.targetsMeasured)"
  }
  if ($s.activeScreens + $s.activePopupPairs -ne $s.activeTargets) {
    Add-Failure "$auditName : 산식 불일치 screen $($s.activeScreens) + popup쌍 $($s.activePopupPairs) != 활성 $($s.activeTargets)"
  }
  if ($s.activeUniquePopupIds -lt 1 -or $s.activeUniquePopupIds -gt $s.activePopupPairs) {
    Add-Failure "$auditName : 고유 popup ID 수가 비정상 ($($s.activeUniquePopupIds))"
  }
  if ($s.noRendererIds.Count -gt 0) { Add-Failure "$auditName : 렌더러 없는 활성 ID $($s.noRendererIds.Count)건 — 조사 필요" }
  if ($s.sheetBodyUnder3.Count -gt 0) { Add-Failure "$auditName : 시트 본문 3요소 미만 $($s.sheetBodyUnder3.Count)건" }
  if ($s.offScaleOutsideShellAllowlist.Count -gt 0) {
    Add-Failure "$auditName : 허용 목록 밖 스케일 위반 — $($s.offScaleOutsideShellAllowlist -join ', ')"
  }
  $requiredPasses = @('pc', 'mobile320', 'mobile320z2', 'mobile320t2')
  foreach ($passId in $requiredPasses) {
    if ($null -eq $s.passes.$passId) { Add-Failure "$auditName : 검수 패스 $passId 누락" }
  }

  # 0 이어야 하는 지표의 위반을 알려진 미해결 목록과 양방향 대조한다.
  # 목록에 없는 위반 → 새 회귀이므로 FAIL. 목록에 있는데 재현 안 됨 → 낡은 예외이므로 FAIL.
  # 그래서 이 목록은 '무시 목록'이 아니라 '고쳐야 할 것의 정확한 잔여 목록'이다.
  $knownName = 'full-page-flow-prototype-render-audit-known.json'
  $knownPath = Join-Path $PrototypeDirectory $knownName
  if (-not (Test-Path -LiteralPath $knownPath)) {
    Add-Failure "$knownName : 알려진 미해결 목록이 없음"
  }
  else {
    $known = Read-Utf8 $knownPath | ConvertFrom-Json
    $allowed = @{}
    foreach ($d in $known.knownDefects) {
      foreach ($t in $d.targets) { $allowed["$($d.pass)|$($d.metric)|$t"] = $d.id }
    }
    $observed = @{}
    foreach ($passId in $s.violations.PSObject.Properties.Name) {
      foreach ($metric in $s.violations.$passId.PSObject.Properties.Name) {
        foreach ($t in $s.violations.$passId.$metric) { $observed["$passId|$metric|$t"] = $true }
      }
    }
    foreach ($k in $observed.Keys) {
      if (-not $allowed.ContainsKey($k)) { Add-Failure "$auditName : 알려지지 않은 위반 — $k" }
    }
    foreach ($k in $allowed.Keys) {
      if (-not $observed.ContainsKey($k)) { Add-Failure "$knownName : 재현되지 않는 예외 $($allowed[$k]) — $k. 해결됐다면 목록에서 지운다" }
    }
    # 존재 여부만 대조하면 5px 넘침이 50px 이 돼도 같은 1건이라 통과한다.
    # 항목마다 크기 상한(maxPx)을 두고 실측이 그보다 크면 악화로 본다 ([L11]).
    foreach ($d in $known.knownDefects) {
      if ($null -eq $d.maxPx) { Add-Failure "$knownName : $($d.id) 에 maxPx 가 없음 - 크기 없이는 악화를 못 잡는다"; continue }
      $ps = $s.passes.($d.pass)
      if ($null -eq $ps) { continue }
      $actual = $null
      if ($d.metric -eq 'phoneOverflow')         { $actual = [double]$ps.phoneOverflowMaxPx }
      elseif ($d.metric -eq 'documentOverflow')  { $actual = [double]$ps.documentOverflowMaxPx }
      elseif ($d.metric -eq 'viewportEscapees')  { $actual = [double]$ps.escapeeMaxPx }
      if ($null -eq $actual) { continue }
      if ($actual -gt ([double]$d.maxPx + 0.5)) {
        Add-Failure "$auditName : $($d.id) 악화 - $($d.pass)/$($d.metric) 실측 $actual px 이 상한 $($d.maxPx) px 초과"
      }
    }
  }
}

# --- 디자인 감사 증거 결속 (PRT-191) ---
# 토큰 기획서가 인용하는 타이포·색·간격·반경·그림자·컨트롤·터치·아이콘 수치는
# design-audit 스크립트의 출력에서만 인용한다. render-audit 과 같은 방식으로
# "지금 이 적용본, 지금 이 동기화 ID, 지금 이 스크립트" 에 묶여 있는지 확인한다.
$designAuditName = 'full-page-flow-prototype-design-audit.json'
$designAuditScriptName = 'full-page-flow-prototype-design-audit.mjs'
$designAuditPath = Join-Path $PrototypeDirectory $designAuditName
$designAuditScriptPath = Join-Path $PrototypeDirectory $designAuditScriptName
if (-not (Test-Path -LiteralPath $designAuditPath)) {
  Add-Failure "$designAuditName : 디자인 감사 결과가 없음"
}
elseif (-not (Test-Path -LiteralPath $designAuditScriptPath)) {
  Add-Failure "$designAuditScriptName : 디자인 감사 스크립트가 없음"
}
else {
  $dAudit = Read-Utf8 $designAuditPath | ConvertFrom-Json
  $dAppliedSha = Get-NormalizedTextSha256 (Read-Utf8 (Join-Path $PrototypeDirectory '0_full-page-flow-prototype-ui-applied.html'))
  $dScriptSha = Get-NormalizedTextSha256 (Read-Utf8 $designAuditScriptPath)
  if ($dAudit.manifest.target.sha256 -ne $dAppliedSha) {
    Add-Failure "$designAuditName : 적용본 SHA 불일치. 감사=$($dAudit.manifest.target.sha256) 현재=$dAppliedSha. 재측정 필요"
  }
  if ($dAudit.manifest.target.designSyncId -ne $syncId) {
    Add-Failure "$designAuditName : 동기화 ID 불일치. 감사=$($dAudit.manifest.target.designSyncId) 현재=$syncId"
  }
  if ($dAudit.manifest.script.sha256 -ne $dScriptSha) {
    Add-Failure "$designAuditName : 측정 스크립트 SHA 불일치. 감사=$($dAudit.manifest.script.sha256) 현재=$dScriptSha"
  }
  # 측정 규칙이 결과에 같이 적혀 있어야 한다. 규칙 없는 숫자는 재현할 수 없다.
  foreach ($ruleKey in @('대상', '아이콘', '슬롯', '카드', '간격', 'margin auto', '출처', '타이포', '컨트롤')) {
    if ($null -eq $dAudit.manifest.rules.$ruleKey) {
      Add-Failure "$designAuditName : 측정 규칙 '$ruleKey' 누락"
    }
  }
  if ($dAudit.manifest.targetsMeasured -lt 1) { Add-Failure "$designAuditName : 측정 target 이 없음" }
  # 두 감사를 서로 대조한다. 디자인 감사는 활성 target 만 재므로 렌더 감사의 activeTargets 와
  # 같아야 한다. 한쪽만 고쳐 쓰면 여기서 어긋난다.
  if ($null -ne $audit -and $null -ne $audit.summary.activeTargets) {
    if ($dAudit.manifest.targetsMeasured -ne $audit.summary.activeTargets) {
      Add-Failure "$designAuditName : 측정 target $($dAudit.manifest.targetsMeasured) 이 렌더 감사의 활성 target $($audit.summary.activeTargets) 과 불일치"
    }
    if ($dAudit.manifest.target.sha256 -ne $audit.manifest.target.sha256) {
      Add-Failure "$designAuditName : 두 감사의 적용본 SHA 가 서로 다름"
    }
  }
  if ($null -eq $dAudit.manifest.marginAutoExcluded) {
    Add-Failure "$designAuditName : margin auto 제외 개수가 기록되지 않음"
  }
  # 축별 산식 단언 — 종류가 0 인 축이 있으면 측정이 무너진 것이다.
  foreach ($axis in @('typo', 'color', 'space', 'radius', 'shadow', 'control', 'touch', 'icon')) {
    $bucket = $dAudit.summary.$axis
    if ($null -eq $bucket) { Add-Failure "$designAuditName : 축 $axis 누락"; continue }
    if ($bucket.'종류' -lt 1) { Add-Failure "$designAuditName : 축 $axis 의 종류가 0" }
    if ($bucket.'합계' -lt $bucket.'종류') {
      Add-Failure "$designAuditName : 축 $axis 산식 불일치 합계 $($bucket.'합계') < 종류 $($bucket.'종류')"
    }
    $listed = ($dAudit.$axis | Measure-Object).Count
    if ($listed -ne $bucket.'종류') {
      Add-Failure "$designAuditName : 축 $axis 의 목록 $listed 건과 요약 종류 $($bucket.'종류') 불일치"
    }
    $sum = 0
    foreach ($row in $dAudit.$axis) { $sum += $row.n }
    if ($sum -ne $bucket.'합계') {
      Add-Failure "$designAuditName : 축 $axis 의 항목 합 $sum 과 요약 합계 $($bucket.'합계') 불일치"
    }
  }
}

# --- 글로벌 스트레스 증거 결속 (PRT-192) ---
# 한국어는 같은 뜻을 가장 짧게 쓰는 언어에 가깝다. 한국어 320px 에서 딱 맞는 레이아웃은
# 번역하면 거의 항상 깨진다. UI 가이드 `C-20` 의 "30~50% 긴 번역" 검수를 이 증거가 담는다.
$i18nName = 'full-page-flow-prototype-i18n-stress.json'
$i18nScriptName = 'full-page-flow-prototype-i18n-stress.mjs'
$i18nPath = Join-Path $PrototypeDirectory $i18nName
$i18nScriptPath = Join-Path $PrototypeDirectory $i18nScriptName
if (-not (Test-Path -LiteralPath $i18nPath)) {
  Add-Failure "$i18nName : 글로벌 스트레스 결과가 없음"
}
elseif (-not (Test-Path -LiteralPath $i18nScriptPath)) {
  Add-Failure "$i18nScriptName : 글로벌 스트레스 스크립트가 없음"
}
else {
  $iAudit = Read-Utf8 $i18nPath | ConvertFrom-Json
  $iAppliedSha = Get-NormalizedTextSha256 (Read-Utf8 (Join-Path $PrototypeDirectory '0_full-page-flow-prototype-ui-applied.html'))
  $iScriptSha = Get-NormalizedTextSha256 (Read-Utf8 $i18nScriptPath)
  if ($iAudit.manifest.target.sha256 -ne $iAppliedSha) {
    Add-Failure "$i18nName : 적용본 SHA 불일치. 감사=$($iAudit.manifest.target.sha256) 현재=$iAppliedSha. 재측정 필요"
  }
  if ($iAudit.manifest.target.designSyncId -ne $syncId) {
    Add-Failure "$i18nName : 동기화 ID 불일치. 감사=$($iAudit.manifest.target.designSyncId) 현재=$syncId"
  }
  if ($iAudit.manifest.script.sha256 -ne $iScriptSha) {
    Add-Failure "$i18nName : 측정 스크립트 SHA 불일치. 감사=$($iAudit.manifest.script.sha256) 현재=$iScriptSha"
  }
  foreach ($ruleKey in @('번역문', '단위', '숫자', '아이콘', '셸', '기준선', '가로 스크롤', '붙음', '집계 단위', '정확도', '오차 방향', '재현하지 않는 것')) {
    if ($null -eq $iAudit.manifest.rules.$ruleKey) { Add-Failure "$i18nName : 측정 규칙 '$ruleKey' 누락" }
  }
  # 확대 정확도를 보고하지 않으면 "잘림 0" 이 무엇을 뜻하는지 알 수 없다.
  # 특히 덜 늘어난 요소의 잘림 0 은 보수적이 아니라 낙관적이므로 atRisk 를 반드시 남긴다.
  foreach ($passId in @('w130', 'w150', 'w130t2')) {
    $st = $iAudit.summary.stretch.$passId
    if ($null -eq $st) { Add-Failure "$i18nName : $passId 확대 통계 누락"; continue }
    if ($null -eq $st.errorHistogram -and $passId -ne 'w130t2') { Add-Failure "$i18nName : $passId 오차 분포(errorHistogram) 누락" }
    # 글자 확대 패스는 폭 목표가 성립하지 않아 오차·atRisk 를 재지 않는다(그 이유가 적혀 있어야 한다)
    if ($passId -eq 'w130t2') {
      if ([string]::IsNullOrWhiteSpace($st.widthErrorNote)) {
        Add-Failure "$i18nName : w130t2 에서 폭 오차를 재지 않은 이유가 기록되지 않았다"
      }
      continue
    }
    if ($null -eq $st.atRiskCount)    { Add-Failure "$i18nName : $passId atRisk 개수 누락 — 덜 늘어난 요소가 제대로 늘렸을 때 넘쳤을지 판정하지 않았다" }
    if ($null -eq $st.underStretched) { Add-Failure "$i18nName : $passId underStretched 누락" }
  }
  if ($null -ne $audit -and $null -ne $audit.summary.activeTargets) {
    if ($iAudit.manifest.targetsMeasured -ne $audit.summary.activeTargets) {
      Add-Failure "$i18nName : 측정 target $($iAudit.manifest.targetsMeasured) 이 렌더 감사의 활성 target $($audit.summary.activeTargets) 과 불일치"
    }
  }
  # 패스 4종이 다 있어야 한다. 기준선이 없으면 "번역 때문에 깨졌다"를 말할 수 없다.
  foreach ($passId in @('base', 'w130', 'w150', 'w130t2')) {
    if ($null -eq $iAudit.summary.passes.$passId) { Add-Failure "$i18nName : 검수 패스 $passId 누락" }
  }
  # 기준선(한국어 320px)은 깨끗해야 한다. 여기가 깨져 있으면 그건 번역 문제가 아니라
  # 이미 있는 제품 결함이고, render-audit 이 먼저 잡았어야 한다.
  $b = $iAudit.summary.passes.base
  if ($null -ne $b) {
    if ($b.targetsWithClipped -ne 0) { Add-Failure "$i18nName : 기준선에서 잘림 $($b.targetsWithClipped)건 — 번역 이전의 결함" }
    if ($b.targetsWithEscapee -ne 0) { Add-Failure "$i18nName : 기준선에서 화면 이탈 $($b.targetsWithEscapee)건 — 번역 이전의 결함" }
    if ($b.targetsWithPhoneOverflow -ne 0) { Add-Failure "$i18nName : 기준선에서 가로 넘침 $($b.targetsWithPhoneOverflow)건 — 번역 이전의 결함" }
  }
  # atRisk 를 개수로만 비교하면 106건이 다른 106건으로 바뀌어도 통과한다.
  # 알려진 잔여 목록과 **양방향 + 크기**로 대조한다.
  $knownI18nName = 'full-page-flow-prototype-i18n-known.json'
  $knownI18nPath = Join-Path $PrototypeDirectory $knownI18nName
  if (-not (Test-Path -LiteralPath $knownI18nPath)) {
    Add-Failure "$knownI18nName : atRisk 알려진 잔여 목록이 없음"
  }
  else {
    $knownI18n = Read-Utf8 $knownI18nPath | ConvertFrom-Json
    if ($knownI18n.boundTo.target -ne $iAudit.manifest.target.sha256) {
      Add-Failure "$knownI18nName : 결속된 적용본 SHA 가 현재 감사와 다름. 재생성 필요"
    }
    $observed = @{}
    $rawRows = 0
    foreach ($passId in @('w130', 'w150')) {
      foreach ($r in $iAudit.summary.stretch.$passId.atRisk) {
        $rawRows++
        # 키에 host 색인을 넣어야 유일해진다. selector 만 쓰면 같은 목록의 여러 행이
        # 한 키로 뭉개져, 다섯 행이 나빠져도 마지막 하나만 그대로면 통과한다 ([L13]).
        $key = "$passId|$($r.target)|$($r.sel)|$($r.hostIndex)"
        if ($observed.ContainsKey($key)) {
          Add-Failure "$i18nName : atRisk 키 중복 - $key. 유일하지 않은 키는 조용히 행을 지운다"
        }
        $observed[$key] = [double]$r.missing
      }
    }
    # 원시 행 수와 키 수가 같아야 한다. 다르면 어딘가에서 행이 사라진 것이다.
    if ($rawRows -ne $observed.Count) {
      Add-Failure "$i18nName : atRisk 원시 행 $rawRows 과 고유 키 $($observed.Count) 불일치 - 덮어써진 행이 있다"
    }
    $knownKeys = @{}
    foreach ($prop in $knownI18n.entries.PSObject.Properties) { $knownKeys[$prop.Name] = [double]$prop.Value.missing }
    foreach ($k in $observed.Keys) {
      if (-not $knownKeys.ContainsKey($k)) { Add-Failure "$i18nName : 알려지지 않은 atRisk — $k (새 회귀)" }
      elseif ($observed[$k] -gt $knownKeys[$k] + 0.5) {
        Add-Failure "$i18nName : atRisk 악화 — $k 부족 폭 $($knownKeys[$k]) → $($observed[$k])"
      }
    }
    # 사라진 행은 자동 통과가 아니다. 개선일 수도 있고 요소를 숨기거나 잘라낸 결과일 수도 있다.
    # UI 가이드 §6.1 이 "숨기지 않는다" 를 계약해 놓았는데 게이트가 숨김을 개선으로 세면
    # 계약과 게이트가 어긋난다. 그래서 사라진 키는 resolved 장부에 사유·근거·PRT 가
    # 적혀 있을 때만 통과한다 (페이블 검수, PRT-202).
    $resolved = @{}
    if ($null -ne $knownI18n.resolved) {
      foreach ($prop in $knownI18n.resolved.PSObject.Properties) { $resolved[$prop.Name] = $prop.Value }
    }
    foreach ($k in $knownKeys.Keys) {
      if ($observed.ContainsKey($k)) { continue }
      if (-not $resolved.ContainsKey($k)) {
        Add-Failure "$knownI18nName : atRisk 사라짐 - $k. 개선인지 숨김인지 resolved 에 사유를 적어야 한다"
        continue
      }
      $r = $resolved[$k]
      foreach ($field in @('사유', '근거', 'prt')) {
        if ([string]::IsNullOrWhiteSpace([string]$r.$field)) {
          Add-Failure "$knownI18nName : resolved[$k] 의 '$field' 가 비어 있음 - 사라진 이유 없이 통과시킬 수 없다"
        }
      }
    }
    # 낡은 resolved 는 지운다. 다시 관측되는데 해소로 적혀 있으면 장부가 거짓말을 한다.
    foreach ($k in $resolved.Keys) {
      if ($observed.ContainsKey($k)) {
        Add-Failure "$knownI18nName : resolved[$k] 가 다시 관측됨 - 해소 항목이 낡았다"
      }
      if (-not $knownKeys.ContainsKey($k)) {
        Add-Failure "$knownI18nName : resolved[$k] 가 entries 에 없음 - 근거 없는 해소 항목"
      }
    }
  }

  # 확대가 실제로 일어났는지 단언한다. 0건이면 스트레스를 안 준 채로 통과할 수 있다.
  if ($iAudit.summary.stretch.w130.stretched -lt 1) { Add-Failure "$i18nName : w130 에서 늘어난 텍스트가 없음 — 스트레스가 걸리지 않았다" }
  if ($iAudit.summary.stretch.w130t2.text2x -lt 1) { Add-Failure "$i18nName : w130t2 에서 글자 확대가 적용되지 않았다" }
  if ($iAudit.summary.stretch.w130t2.text2xMismatched -ne 0) {
    Add-Failure "$i18nName : 글자 확대가 기준×2 와 어긋난 요소 $($iAudit.summary.stretch.w130t2.text2xMismatched)건 — 상속이 겹쳤거나 우선순위에 졌다"
  }
  if ($iAudit.summary.stretch.w130.skippedNumeric -lt 1) { Add-Failure "$i18nName : 숫자 제외가 0건 — 숫자까지 늘렸을 가능성" }
}

# --- atRisk 키 교체 증명 결속 (PRT-202) ---
# "새 키가 데이터를 되살렸다" 는 추론이 아니라 재현이어야 한다. 이 증명은 두 키 스킴을
# 나란히 돌려, 같은 악화를 옛 스킴은 놓치고 새 스킴은 잡는다는 것을 실행으로 보인다.
$proofName = 'full-page-flow-prototype-atrisk-key-proof.json'
$proofScriptName = 'full-page-flow-prototype-atrisk-key-proof.mjs'
$proofPath = Join-Path $PrototypeDirectory $proofName
$proofScriptPath = Join-Path $PrototypeDirectory $proofScriptName
if (-not (Test-Path -LiteralPath $proofPath)) {
  Add-Failure "$proofName : 키 교체 증명이 없음"
}
elseif (-not (Test-Path -LiteralPath $proofScriptPath)) {
  Add-Failure "$proofScriptName : 증명 스크립트가 없음"
}
else {
  $proof = Read-Utf8 $proofPath | ConvertFrom-Json
  $proofScriptSha = Get-NormalizedTextSha256 (Read-Utf8 $proofScriptPath)
  if ($proof.manifest.script.sha256 -ne $proofScriptSha) {
    Add-Failure "$proofName : 증명 스크립트 SHA 불일치. 재실행 필요"
  }
  if ($proof.manifest.target.designSyncId -ne $syncId) {
    Add-Failure "$proofName : 동기화 ID 불일치. 증명=$($proof.manifest.target.designSyncId) 현재=$syncId"
  }
  $srcStress = Get-NormalizedTextSha256 (Read-Utf8 (Join-Path $PrototypeDirectory $i18nName))
  $srcKnown = Get-NormalizedTextSha256 (Read-Utf8 (Join-Path $PrototypeDirectory $knownI18nName))
  if ($proof.manifest.source.stress.sha256 -ne $srcStress) {
    Add-Failure "$proofName : 스트레스 결과 SHA 불일치. 증명이 낡았다"
  }
  if ($proof.manifest.source.known.sha256 -ne $srcKnown) {
    Add-Failure "$proofName : atRisk 기준선 SHA 불일치. 증명이 낡았다"
  }
  if ($proof.summary.newUniqueKeys -ne $proof.summary.rows) {
    Add-Failure "$proofName : 새 키가 유일하지 않음 - 행 $($proof.summary.rows) 키 $($proof.summary.newUniqueKeys)"
  }
  if ($proof.summary.oldUniqueKeys -ge $proof.summary.rows) {
    Add-Failure "$proofName : 옛 키가 행을 잃지 않았다면 이 증명이 성립하지 않는다"
  }
  if ($proof.summary.worsening.old.verdict -ne 'PASS') {
    Add-Failure "$proofName : 거짓 음성이 재현되지 않음 - 옛 스킴 판정 $($proof.summary.worsening.old.verdict)"
  }
  if ($proof.summary.worsening.new.verdict -ne 'FAIL') {
    Add-Failure "$proofName : 새 스킴이 악화를 놓침 - 판정 $($proof.summary.worsening.new.verdict)"
  }
  if ($proof.summary.deletion.goneIsFail.verdict -ne 'FAIL') {
    Add-Failure "$proofName : 행 삭제가 잡히지 않음 - 숨김이 개선으로 기록될 수 있다"
  }
  if (-not $proof.summary.allAssertionsHold) {
    Add-Failure "$proofName : 단언 중 성립하지 않는 것이 있다"
  }
}

# --- 대비 증거 결속 (PRT-198) ---
# 색 결정은 대비 없이는 답할 수 없다. 대비 결과가 지금 이 감사·이 적용본에 묶여 있는지 본다.
$contrastName = 'full-page-flow-prototype-contrast-fix.json'
$contrastPath = Join-Path $PrototypeDirectory $contrastName
if (-not (Test-Path -LiteralPath $contrastPath)) {
  Add-Failure "$contrastName : 대비 결과가 없음"
}
else {
  $cf = Read-Utf8 $contrastPath | ConvertFrom-Json
  if ($cf.manifest.designAudit.targetSha256 -ne $dAppliedSha) {
    Add-Failure "$contrastName : 적용본 SHA 불일치. 재측정 필요"
  }
  if ($cf.manifest.designAudit.designSyncId -ne $syncId) {
    Add-Failure "$contrastName : 동기화 ID 불일치"
  }
  foreach ($ruleKey in @('기준', '수정안', '방향')) {
    if ($null -eq $cf.manifest.rules.$ruleKey) { Add-Failure "$contrastName : 측정 규칙 '$ruleKey' 누락" }
  }
  if ($cf.summary.pairs -lt 1) { Add-Failure "$contrastName : 비교한 색 쌍이 없음" }
  # 실패 쌍마다 **어디를 어떻게 고치면 되는지**가 있어야 한다.
  # 수치만 내고 통과선까지의 거리를 안 내면 결정에 쓸 수 없다.
  foreach ($row in $cf.rows) {
    if (-not $row.passAA -and $null -eq $row.fix -and $null -eq $row.fixBackground) {
      Add-Failure "$contrastName : $($row.fg) on $($row.bg) 가 AA 실패인데 통과 색이 없음"
    }
  }
}

if ($failures.Count -gt 0) {
  Write-Output "DESIGN DOC SYNC: FAIL ($syncId)"
  $failures | ForEach-Object { Write-Output "- $_" }
  exit 1
}

$hashes = [ordered]@{}
foreach ($fileName in $contentsByFile.Keys) {
  $hashes[$fileName] = Get-Sha256 $contentsByFile[$fileName]
}
foreach ($fileName in @($auditName, $auditScriptName, 'full-page-flow-prototype-render-audit-known.json', $designAuditName, $designAuditScriptName, $i18nName, $i18nScriptName,
    'full-page-flow-prototype-token-map.json', 'full-page-flow-prototype-token-map-check.mjs',
    'full-page-flow-prototype-token-map-check.json', 'full-page-flow-prototype-i18n-known.json',
    'full-page-flow-prototype-contrast-fix.json', 'full-page-flow-prototype-contrast-fix.mjs',
    'full-page-flow-prototype-atrisk-key-proof.json', 'full-page-flow-prototype-atrisk-key-proof.mjs',
    'full-page-flow-prototype-text-sha256.mjs', 'full-page-flow-prototype-text-sha256.test.mjs',
    'full-page-flow-prototype-hash-inventory.json',
    'full-page-flow-prototype-design-sync-check.ps1',
    'full-page-flow-prototype-app-token-map.json', 'full-page-flow-prototype-app-map-check.mjs',
    'full-page-flow-prototype-app-map-check.test.mjs',
    'full-page-flow-prototype-app-map-check.json', '../token-adoption-audit.json',
    '../../scripts/token-adoption-audit.mjs', '../../scripts/token-adoption-numeric-literal.mjs',
    '../../scripts/token-adoption-numeric-literal.test.mjs',
    'full-page-flow-prototype-axis-measure.mjs', 'full-page-flow-prototype-axis-at.json',
    'full-page-flow-prototype-role-measure.mjs', 'full-page-flow-prototype-role-at.json',
    'full-page-flow-prototype-doc-claims.json', 'full-page-flow-prototype-doc-claims-check.mjs',
    'full-page-flow-prototype-doc-claims-check.test.mjs', 'full-page-flow-prototype-doc-claims-check.json',
    'full-page-flow-prototype-contrast-contract.json', 'full-page-flow-prototype-contrast-gate.mjs',
    'full-page-flow-prototype-contrast-gate.json',
    'full-page-flow-prototype-color-usage.json', 'full-page-flow-prototype-s2-geometry-diff.json',
    'full-page-flow-prototype-s3a-diff.json',
    '../../scripts/design-token-color-usage-known.json', '../../scripts/design-token-color-usage.mjs',
    '../../scripts/design-token-color-usage.test.mjs', '../../scripts/design-token-geometry-diff.mjs',
    '../../scripts/design-token-geometry-diff.test.mjs', '../../scripts/design-token-s3a-known.json',
    '../../scripts/design-token-s3a-diff.mjs', '../../scripts/design-token-s3a-diff.test.mjs',
    '../../scripts/design-token-s4-contract.json', '../../scripts/design-token-s4-check.mjs',
    '../../scripts/design-token-s4-check.test.mjs',
    '../../scripts/design-token-s3b-known.json', '../../scripts/design-token-s3b-diff.mjs',
    '../../scripts/design-token-s3b-diff.test.mjs',
    'full-page-flow-prototype-s3c-diff.json',
    '../../scripts/design-token-s3c-known.json', '../../scripts/design-token-s3c-diff.mjs',
    '../../scripts/design-token-s3c-diff.test.mjs',
    'full-page-flow-prototype-s3d-diff.json',
    '../../scripts/design-token-s3d-known.json', '../../scripts/design-token-s3d-diff.mjs',
    '../../scripts/design-token-s3d-diff.test.mjs',
    'full-page-flow-prototype-motion-layer-audit.json',
    '../../scripts/design-token-motion-layer-audit.mjs',
    '../../scripts/design-token-motion-layer-audit.test.mjs',
    '../../scripts/touch-target-known.json', '../../scripts/touch-target-audit.mjs',
    '../../scripts/touch-target-audit.test.mjs',
    'native-touch-android-1x.json', 'native-touch-android-2x.json',
    'native-touch-ios-1x.json', 'native-touch-ios-2x.json',
    'native-touch-android-tap-probe.json', 'native-touch-ios-tap-probe.json', 'native-touch-android-receipt.json',
    '../../scripts/native-touch-runtime-contract.json', '../../scripts/native-touch-runtime-known.json',
    '../../scripts/native-touch-runtime-audit.mjs', '../../scripts/native-touch-runtime-audit.test.mjs',
    '../../scripts/native-touch-runtime-tap-probe.mjs',
    '../../scripts/native-touch-runtime-evidence-check.mjs',
    '../../scripts/native-touch-runtime-evidence-check.test.mjs',
    '../../scripts/native-touch-runtime-rederive.mjs',
    '../../scripts/native-touch-runtime-rederive.test.mjs',
    'native-text-scale-ios-1x.json', 'native-text-scale-ios-2x.json',
    '../../scripts/native-text-scale-audit.mjs',
    '../../scripts/native-text-scale-evidence-check.mjs',
    '../../scripts/native-text-scale-evidence-check.test.mjs',
    '../디자인-토큰-3계층-값-매핑-기획서.md')) {
  $contents = Read-Utf8 (Join-Path $PrototypeDirectory $fileName)
  $nativeClosureRequired = @(
    'native-touch-ios-1x.json', 'native-touch-ios-2x.json', 'native-touch-ios-tap-probe.json',
    '../../scripts/native-touch-runtime-rederive.mjs', '../../scripts/native-touch-runtime-rederive.test.mjs',
    'native-text-scale-ios-1x.json', 'native-text-scale-ios-2x.json',
    '../../scripts/native-text-scale-audit.mjs', '../../scripts/native-text-scale-evidence-check.mjs',
    '../../scripts/native-text-scale-evidence-check.test.mjs'
  )
  if ($null -ne $contents) { $hashes[$fileName] = Get-Sha256 $contents }
  elseif ($nativeClosureRequired -contains $fileName) { Add-Failure "$fileName : 네이티브 종결 봉인 파일 없음" }
}

# --- 문서 주장 대조 결속 (PRT-209 · 페이블 제안) ---
# 문서가 숫자 목록으로 한 주장을 코드 실측과 대조한 결과를 묶는다.
# 이 회차에만 문서가 코드보다 앞서 있던 자리가 다섯 번 나왔고, 그중 하나(§7.3.1 스크롤 목록)는
# 값 개수와 총 건수가 우연히 같아 눈으로도 개수 대조로도 안 걸렸다.
$claimsCheckName = 'full-page-flow-prototype-doc-claims-check.json'
$claimsScriptName = 'full-page-flow-prototype-doc-claims-check.mjs'
$claimsName = 'full-page-flow-prototype-doc-claims.json'
$claimsCheckPath = Join-Path $PrototypeDirectory $claimsCheckName
if (-not (Test-Path -LiteralPath $claimsCheckPath)) {
  Add-Failure "$claimsCheckName : 문서 주장 대조 결과가 없음"
} else {
  $claimsCheck = Read-Utf8 $claimsCheckPath | ConvertFrom-Json
  $claimsScriptSha = Get-Sha256 ((Read-Utf8 (Join-Path $PrototypeDirectory $claimsScriptName)).Replace("`r`n", "`n"))
  $claimsSha = Get-Sha256 ((Read-Utf8 (Join-Path $PrototypeDirectory $claimsName)).Replace("`r`n", "`n"))
  $claimsAuditSha = Get-Sha256 ((Read-Utf8 (Join-Path $PrototypeDirectory '../token-adoption-audit.json')).Replace("`r`n", "`n"))
  if ($claimsCheck.manifest.scriptSha256 -ne $claimsScriptSha) { Add-Failure "$claimsCheckName : 검사기 SHA 불일치. 재실행 필요" }
  if ($claimsCheck.manifest.claimsSha256 -ne $claimsSha) { Add-Failure "$claimsCheckName : 주장 목록 SHA 불일치. 재실행 필요" }
  if ($claimsCheck.manifest.auditSha256 -ne $claimsAuditSha) { Add-Failure "$claimsCheckName : 감사 SHA 불일치. 대조가 낡았다" }
  if ($claimsCheck.status -ne 'PASS') {
    foreach ($f in $claimsCheck.failures) { Add-Failure "$claimsCheckName : $f" }
  }
  if ([int]$claimsCheck.claimCount -lt 5) { Add-Failure "$claimsCheckName : 주장이 $($claimsCheck.claimCount)건 - 목록이 줄었다" }
}

# --- 색 대비 게이트 결속 (PRT-209 · 페이블 요청 2) ---
# 승인된 색 중 셋이 AA 선에 여유 0 으로 붙어 있다. 문서 계약은 표면 색이 바뀌는 커밋에서
# 아무것도 하지 않으므로, 절대 기준(4.5:1 / 3:1)으로 매 커밋 재검산한다.
# baseline 비교가 아니다 - 바뀐 값이 새 baseline 이 되어 조용히 통과하면 안 된다.
$contrastName = 'full-page-flow-prototype-contrast-gate.json'
$contrastScriptName = 'full-page-flow-prototype-contrast-gate.mjs'
$contractName = 'full-page-flow-prototype-contrast-contract.json'
$contrastPath = Join-Path $PrototypeDirectory $contrastName
if (-not (Test-Path -LiteralPath $contrastPath)) {
  Add-Failure "$contrastName : 색 대비 검사 결과가 없음"
} else {
  $contrast = Read-Utf8 $contrastPath | ConvertFrom-Json
  $contrastScriptSha = Get-NormalizedTextSha256 (Read-Utf8 (Join-Path $PrototypeDirectory $contrastScriptName))
  $contractSha = Get-NormalizedTextSha256 (Read-Utf8 (Join-Path $PrototypeDirectory $contractName))
  if ($contrast.manifest.scriptSha256 -ne $contrastScriptSha) { Add-Failure "$contrastName : 검사기 SHA 불일치. 재실행 필요" }
  if ($contrast.manifest.contractSha256 -ne $contractSha) { Add-Failure "$contrastName : 조합표 SHA 불일치. 재실행 필요" }
  if ($contrast.status -eq 'FAIL') {
    foreach ($f in $contrast.failures) { Add-Failure "$contrastName : $f" }
  }
  # 경계값은 통과시키되 **보이게** 둔다. 사라지면 조합표가 조용히 바뀐 것이다.
  if ($null -eq $contrast.boundaryCount) { Add-Failure "$contrastName : 경계값 수가 없음" }
  # PRT-210 에서 text.link/required 를 #1465DB 로 정정해 경계값 넷 중 둘이 해소됐다.
  # 남은 둘(흰 글자 on action.primary 4.50 · text.tertiary on bg 4.50)은 소유자가 "그대로 두고
  # 경계값으로 표시" 로 판단한 자리다. 줄어들면 조합표가 조용히 바뀐 것이므로 걸린다.
  if ([int]$contrast.boundaryCount -lt 2) { Add-Failure "$contrastName : 경계값이 $($contrast.boundaryCount)건 - 남아 있어야 할 둘보다 적다. 조합표가 바뀌었다" }
  if ([int]$contrast.openCount -ne 0) { Add-Failure "$contrastName : 열린 조합이 $($contrast.openCount)건 - PRT-210 에서 0 이 됐다. 새로 열렸다면 §8.3 에 사유가 있어야 한다" }
  if ($null -eq $contrast.openCount) { Add-Failure "$contrastName : 열린 조합 수가 없음" }
}

# --- 앱 선언 전수 배정 결속 (PRT-204 · W1) ---
# 앱 사용처 선언이 다섯 통에 빠짐없이 들어갔는지, 그리고 그 배정이 지금 이 감사·이 매핑표에
# 묶여 있는지 본다. 승인 예외 통은 W1 단계에서 0 이어야 한다 — 승인은 검수 뒤다.
$appCheckName = 'full-page-flow-prototype-app-map-check.json'
$appScriptName = 'full-page-flow-prototype-app-map-check.mjs'
$appMapName = 'full-page-flow-prototype-app-token-map.json'
$appAuditRel = '../token-adoption-audit.json'
$appCheckPath = Join-Path $PrototypeDirectory $appCheckName
$appScriptPath = Join-Path $PrototypeDirectory $appScriptName
if (-not (Test-Path -LiteralPath $appCheckPath)) {
  Add-Failure "$appCheckName : 앱 배정 결과가 없음"
}
elseif (-not (Test-Path -LiteralPath $appScriptPath)) {
  Add-Failure "$appScriptName : 앱 배정 검사기가 없음"
}
else {
  $appCheck = Read-Utf8 $appCheckPath | ConvertFrom-Json
  $appScriptSha = Get-Sha256 ((Read-Utf8 $appScriptPath).Replace("`r`n", "`n"))
  if ($appCheck.manifest.script.sha256 -ne $appScriptSha) {
    Add-Failure "$appCheckName : 검사기 SHA 불일치. 재실행 필요"
  }
  foreach ($pair in @(@{ key = 'audit'; file = $appAuditRel }, @{ key = 'appMap'; file = $appMapName }, @{ key = 'prototypeMap'; file = 'full-page-flow-prototype-token-map.json' })) {
    $srcPath = Join-Path $PrototypeDirectory $pair.file
    if (-not (Test-Path -LiteralPath $srcPath)) { Add-Failure "$appCheckName : 입력 '$($pair.file)' 가 없음"; continue }
    $srcSha = Get-Sha256 ((Read-Utf8 $srcPath).Replace("`r`n", "`n"))
    if ($appCheck.manifest.source.($pair.key).sha256 -ne $srcSha) {
      Add-Failure "$appCheckName : 입력 '$($pair.file)' SHA 불일치. 배정이 낡았다"
    }
  }
  if ($appCheck.summary.status -ne 'PROPOSAL_COMPLETE') {
    Add-Failure "$appCheckName : 상태가 PROPOSAL_COMPLETE 아님 ($($appCheck.summary.status))"
  }
  if ($appCheck.summary.unmatchedCount -ne 0) {
    Add-Failure "$appCheckName : 미분류 $($appCheck.summary.unmatchedCount)건 - 전수 배정이 아니다"
  }
  if ($appCheck.summary.byBin.approvedException -ne 0) {
    Add-Failure "$appCheckName : 승인 예외 통이 $($appCheck.summary.byBin.approvedException)건 - W1 은 제안 단계다"
  }
  $binSum = 0
  foreach ($b in @('primitive', 'componentOwned', 'defect', 'pendingApproval', 'approvedException')) {
    $binSum += [int]$appCheck.summary.byBin.$b
  }
  if ($binSum -ne [int]$appCheck.summary.declarations) {
    Add-Failure "$appCheckName : 통 합계 $binSum 이 선언 $($appCheck.summary.declarations) 과 다르다"
  }
  # 배정을 바꾼 회차는 무엇이 어디로 갔는지 대차를 내야 한다. 손으로 쓴 이동 서술은 어긋난다
  # (PRT-206 에서 실제로 어긋났다). 검사기가 낸 대차가 통 변화와 맞는지 게이트가 다시 본다.
  if ($null -eq $appCheck.summary.binMovementLedger) {
    Add-Failure "$appCheckName : 통 이동 대차가 없음 - 이전 회차 매핑표를 함께 넣어 재실행해야 한다"
  }
  else {
    foreach ($b in @('primitive', 'componentOwned', 'defect', 'pendingApproval', 'approvedException')) {
      $r = $appCheck.summary.binMovementLedger.reconciliation.$b
      if ($null -eq $r) { Add-Failure "$appCheckName : 대차에 '$b' 통이 없음"; continue }
      if ([int]$r.계산 -ne [int]$r.실제) {
        Add-Failure "$appCheckName : 대차 불일치 - $b 계산 $($r.계산) 실제 $($r.실제)"
      }
    }
  }
  # 다중 일치 수는 반드시 기록돼야 한다. "첫 일치가 이긴다" 가 숨은 결정이 되지 않게 한다.
  if ($null -eq $appCheck.summary.multiMatchCount) {
    Add-Failure "$appCheckName : 다중 일치 수가 없음 - 규칙 순서가 배정을 바꾸는지 알 수 없다"
  }
  if ($appCheck.summary.failures.Count -gt 0) {
    foreach ($f in $appCheck.summary.failures) { Add-Failure "$appCheckName : $f" }
  }
}

# --- 완료 조건마다 증거 경로 (PRT-203) ---
# PRT-200 에서 빠진 것은 코드가 아니라 봉인 시점의 증거였다. 조건을 다 못 채운 채 -Finalize 를
# 했고, 한 문단을 더하려고 회차를 하나 더 열어야 했다. 그래서 봉인 자체가 증거를 요구한다.
#
# 맥락 장부의 현재 ID 절에 다음 형태의 블록이 있어야 한다.
#   - 완료 조건:
#     - F05 · full-page-flow-prototype-render-audit-known.json
#     - F01 · full-page-flow-prototype-atrisk-key-proof.json
# 조건 ID 와 증거 경로를 ` · ` 로 잇는다. 형식은 장부의 기존 불릿 그대로다 — 새 스키마가 아니다.
#
# 거부 조건 셋:
#   (가) 항목이 없거나 조건 ID·경로 중 하나가 비었다
#   (나) 경로의 파일이 없다
#   (다) 경로가 이 회차의 봉인 대상이 아니다
# (다)를 "이번 커밋에 포함되지 않은 경로" 의 검사 가능한 형태로 읽었다. 봉인 해시 집합에
# 들어가야 증거가 이 동기화 ID 에 묶이고, 묶이지 않으면 증거만 조용히 바뀔 수 있다.
$ctxSection = $null
$ctxHead = [regex]::Match($context, ('(?m)^###\s+' + [regex]::Escape($syncId) + '\s+·\s+.+$'))
if ($ctxHead.Success) {
  $after = $context.Substring($ctxHead.Index + $ctxHead.Length)
  $nextHead = [regex]::Match($after, '(?m)^###\s+DS-\d{8}-\d{3}\s')
  $ctxSection = if ($nextHead.Success) { $after.Substring(0, $nextHead.Index) } else { $after }
}
if ($null -eq $ctxSection) {
  Add-Failure "$contextName : 현재 ID 절을 찾지 못해 완료 조건을 읽을 수 없다"
}
else {
  $condHead = [regex]::Match($ctxSection, '(?m)^- 완료 조건:\s*$')
  if (-not $condHead.Success) {
    Add-Failure "$contextName : '- 완료 조건:' 블록이 없음 - 조건마다 증거 경로가 있어야 봉인한다"
  }
  else {
    $rest = $ctxSection.Substring($condHead.Index + $condHead.Length)
    $stop = [regex]::Match($rest, '(?m)^- \S')
    $condBlock = if ($stop.Success) { $rest.Substring(0, $stop.Index) } else { $rest }
    # Windows CRLF에서는 `$`가 `\r` 앞에 서지 않아 LF 전용 정규식이 항목 0건을 만들었다.
    $items = [regex]::Matches($condBlock, '(?m)^  - (?<id>[^·\r\n]*)·(?<path>[^\r\n]*)\r?$')
    if ($items.Count -lt 1) {
      Add-Failure "$contextName : 완료 조건 항목이 0건 - '  - <조건 ID> · <증거 경로>' 형태로 적는다"
    }
    foreach ($m in $items) {
      $condId = $m.Groups['id'].Value.Trim()
      $evPath = $m.Groups['path'].Value.Trim().Trim('`')
      if ([string]::IsNullOrWhiteSpace($condId)) { Add-Failure "$contextName : 완료 조건 ID 가 빈 항목이 있음"; continue }
      if ([string]::IsNullOrWhiteSpace($evPath)) { Add-Failure "$contextName : '$condId' 의 증거 경로가 비어 있음"; continue }
      $evFull = Join-Path $PrototypeDirectory $evPath
      if (-not (Test-Path -LiteralPath $evFull)) {
        Add-Failure "$contextName : '$condId' 의 증거 '$evPath' 가 없는 파일이다"
        continue
      }
      if (-not $hashes.Contains($evPath)) {
        Add-Failure "$contextName : '$condId' 의 증거 '$evPath' 가 이 회차 봉인 대상이 아니다 - 묶이지 않은 증거는 조용히 바뀐다"
      }
    }
  }
}

if ($failures.Count -gt 0) {
  Write-Output "DESIGN DOC SYNC: FAIL ($syncId)"
  $failures | ForEach-Object { Write-Output "- $_" }
  exit 1
}

$previousState = if (Test-Path -LiteralPath $statePath) { Read-Utf8 $statePath | ConvertFrom-Json } else { $null }
if ($null -ne $previousState -and $previousState.lastCompletedId -eq $syncId) {
  foreach ($fileName in $hashes.Keys) {
    $previousHash = $previousState.hashes.$fileName
    if ($null -eq $previousHash -or $previousHash -ne $hashes[$fileName]) {
      Add-Failure "$fileName : 완료된 $syncId 이후 변경됨. 새 동기화 ID 필요"
    }
  }
  if ($failures.Count -gt 0) {
    Write-Output "DESIGN DOC SYNC: FAIL ($syncId)"
    $failures | ForEach-Object { Write-Output "- $_" }
    exit 1
  }
}
elseif (-not $Finalize) {
  Write-Output "DESIGN DOC SYNC: FAIL ($syncId)"
  Write-Output '- 새 동기화 ID는 -Finalize로 완료 장부에 등록해야 합니다.'
  exit 1
}
else {
  if ($null -ne $previousState -and $syncId -le $previousState.lastCompletedId) {
    Write-Output "DESIGN DOC SYNC: FAIL ($syncId)"
    Write-Output "- 이전 완료 ID $($previousState.lastCompletedId)보다 큰 새 ID가 필요합니다."
    exit 1
  }
  $state = [ordered]@{
    lastCompletedId = $syncId
    completedAt = [datetimeoffset]::Now.ToString('o')
    overallUiStatus = $overallStatus
    commonChange = $commonChange
    uiChange = $uiChange
    prt = $prtId
    hashes = $hashes
  }
  $stateJson = $state | ConvertTo-Json -Depth 5
  [System.IO.File]::WriteAllText($statePath, $stateJson + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
}

Write-Output "DESIGN DOC SYNC: PASS ($syncId)"
Write-Output "문서 동기화: $syncStatus / 전체 UI 작업: $overallStatus"
Write-Output "공통 변경: $commonChange / UI 변경: $uiChange / 변경 기록: $prtId"
$required.Keys | ForEach-Object { Write-Output "- PASS: $_" }
if ($Finalize) { Write-Output "- FINALIZED: $stateName" }
exit 0
