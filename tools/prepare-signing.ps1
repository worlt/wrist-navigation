$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskJdk = $env:JAVA_HOME
if (-not $taskJdk) {
    $taskJdk = (Get-ChildItem -LiteralPath "$taskRoot\.local\jdk" -Directory -ErrorAction SilentlyContinue | Select-Object -First 1).FullName
}
if (-not $taskJdk) {
    $taskJdk = 'C:\E\dev-tools\jdk-17'
    if (-not (Test-Path -LiteralPath "$taskJdk\bin\java.exe")) { $taskJdk = $null }
}
if (-not $taskJdk -or -not (Test-Path -LiteralPath "$taskJdk\bin\java.exe")) { throw 'Install JDK 17+ and set JAVA_HOME first.' }
New-Item -ItemType Directory -Force -Path "$taskRoot\signing" | Out-Null
if (-not (Test-Path -LiteralPath "$taskRoot\signing\development.p12")) {
    # Never mint a second identity: the band RPK and the phone APK must share one certificate.
    & "$taskJdk\bin\java.exe" "$PSScriptRoot\ImportSigning.java" $taskRoot
    if ($LASTEXITCODE -ne 0) { throw 'Importing the wearable identity into signing/development.p12 failed.' }
}
& "$taskJdk\bin\java.exe" "$PSScriptRoot\ExportSigning.java" $taskRoot
if ($LASTEXITCODE -ne 0) { throw 'PEM export failed.' }

