$WshShell = New-Object -comObject WScript.Shell
$DesktopPath = [System.Environment]::GetFolderPath('Desktop')
$Shortcut = $WshShell.CreateShortcut("$DesktopPath\Kiran Tally Bridge.lnk")
$target = (Resolve-Path "$PSScriptRoot\..\tally-desktop-app\dist\win-unpacked\Kiran Tally Bridge.exe").Path
$Shortcut.TargetPath = $target
$Shortcut.WorkingDirectory = Split-Path $target
$Shortcut.Description = "CA Kiran K. Shinde & Co. - TallyPrime Cloud Sync Desktop Connector"
$Shortcut.Save()
Write-Host "Desktop shortcut created successfully!"
