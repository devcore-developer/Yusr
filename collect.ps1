# YUSR-FILES3 collector - Educational Stages integration
# Run from the project root:  D:\DevCore\Yusr Al-Maarifa
#   powershell -ExecutionPolicy Bypass -File collect3.ps1
# ASCII only - no Arabic comments to avoid PS 5.1 encoding issues.

 $ErrorActionPreference = "SilentlyContinue"
 $out = "YUSR-FILES3.txt"
if (Test-Path $out) { Remove-Item $out }

 $files = @(
  "prisma\schema.prisma",
  "package.json",
  "src\lib\auth.ts",
  "src\lib\utils.ts",
  "src\features\admin\actions.ts",
  "src\app\(dashboard)\users\page.tsx",
  "src\app\(dashboard)\settings\page.tsx",
  "src\app\(dashboard)\settings\actions.ts",
  "src\features\settings\actions.ts",
  "src\app\(school-manager)\school-manager\users\actions.ts",
  "src\app\(school-manager)\school-manager\users\add\page.tsx",
  "src\app\(school-manager)\school-manager\users\[userId]\page.tsx",
  "src\app\(school-manager)\school-manager\settings\page.tsx",
  "src\app\(dashboard)\private-review\new\page.tsx",
  "src\app\(dashboard)\private-review\new\actions.ts",
  "src\components\ui\Modal.tsx",
  "src\components\ui\Select.tsx",
  "src\components\ui\Badge.tsx",
  "src\components\ui\Checkbox.tsx"
)

foreach ($f in $files) {
  if (Test-Path $f) {
    Add-Content -Path $out -Value "===== FILE: $f =====" -Encoding UTF8
    Get-Content -Path $f -Encoding UTF8 | Add-Content -Path $out -Encoding UTF8
  } else {
    Add-Content -Path $out -Value "===== NOT FOUND: $f =====" -Encoding UTF8
  }
}

Add-Content -Path $out -Value "" -Encoding UTF8
Add-Content -Path $out -Value "===== SEARCH A: createNewAssessment call sites and users actions =====" -Encoding UTF8
 $sa = & rg -n --no-heading "createNewAssessment" src 2>$null
if (-not $sa) {
  $sa = & findstr /s /n /c:"createNewAssessment" src\*.tsx src\*.ts 2>$null
}
 $sa | Add-Content -Path $out -Encoding UTF8

Add-Content -Path $out -Value "" -Encoding UTF8
Add-Content -Path $out -Value "===== SEARCH B: user create/update forms (admin + school-manager users + settings) =====" -Encoding UTF8
 $sb = & rg -n --no-heading "QUALITY_ASSESSOR|BRANCH_MANAGER" "src\features\admin\actions.ts" "src\app\(school-manager)\school-manager\users" "src\app\(dashboard)\users" "src\app\(dashboard)\settings" 2>$null
if (-not $sb) {
  $sb = & findstr /s /n /c:"QUALITY_ASSESSOR" "src\features\admin\actions.ts" "src\app\(school-manager)\school-manager\users\*.tsx" "src\app\(school-manager)\school-manager\users\*.ts" "src\app\(dashboard)\users\*.tsx" 2>$null
}
 $sb | Add-Content -Path $out -Encoding UTF8

Add-Content -Path $out -Value "" -Encoding UTF8
Add-Content -Path $out -Value "===== DONE YUSR-FILES3 =====" -Encoding UTF8
Write-Host "Collected to $out"