Option Explicit
Dim shell, fso, shortcut, folder, destination
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
folder = fso.GetParentFolderName(WScript.ScriptFullName)
destination = shell.SpecialFolders("Desktop") & "\EOD Radar.lnk"
Set shortcut = shell.CreateShortcut(destination)
shortcut.TargetPath = shell.ExpandEnvironmentStrings("%SystemRoot%") & "\System32\wscript.exe"
shortcut.Arguments = Chr(34) & folder & "\start.vbs" & Chr(34)
shortcut.WorkingDirectory = folder
shortcut.Description = "EOD Radar - Open website and refresh Longbridge data"
shortcut.IconLocation = shell.ExpandEnvironmentStrings("%SystemRoot%") & "\System32\shell32.dll,13"
shortcut.Save
WScript.Echo destination
