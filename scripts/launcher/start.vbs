Option Explicit
Dim shell, fso, folder, node
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
folder = fso.GetParentFolderName(WScript.ScriptFullName)
node = shell.ExpandEnvironmentStrings("%ProgramFiles%") & "\nodejs\node.exe"
If Not fso.FileExists(node) Then node = "node.exe"
shell.Run Chr(34) & node & Chr(34) & " " & Chr(34) & folder & "\server.mjs" & Chr(34), 0, False
