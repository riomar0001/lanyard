; NSIS hooks for the Windows installer (bundle.windows.nsis.installerHooks).

; Stop the bundled Node sidecar left running from this install folder.
; Versions up to 1.0.0-beta.2 kept it alive after the app exited, which
; locks node.exe and fails the upgrade with "Error opening file for writing".
; Matches by full path, so other Node processes on the machine are untouched.
!macro LANYARD_STOP_SIDECAR
  nsExec::Exec `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $$_.Path -eq '$INSTDIR\node.exe' } | Stop-Process -Force -ErrorAction SilentlyContinue"`
  Pop $0
  ; Give Windows a moment to release the file handle.
  Sleep 500
!macroend

!macro NSIS_HOOK_PREINSTALL
  !insertmacro LANYARD_STOP_SIDECAR
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  !insertmacro LANYARD_STOP_SIDECAR
!macroend
