; Request admin privileges (UAC elevation)
RequestExecutionLevel admin

!macro customInit
  ; Check if the app is running before installation starts
  !insertmacro checkRunningApp
!macroend

!macro checkRunningApp
  ; Check if the main process is running
  nsExec::ExecToStack 'tasklist /FI "IMAGENAME eq Google Gemini.exe" /NH'
  Pop $0  ; Exit code
  Pop $1  ; Output
  
  ; Check if the output contains the process name (means it's running)
  ${If} $1 != ""
    StrCpy $2 $1 20  ; Get first 20 chars
    ${If} $2 == "INFO: No tasks are "
      ; App is not running, continue
      Goto appNotRunning
    ${EndIf}
    
    ; App is running - show dialog
    MessageBox MB_YESNO|MB_ICONQUESTION "Google Gemini is currently running.$\n$\nWould you like to close it and continue with the installation?" IDYES closeApp IDNO cancelInstall
    
    closeApp:
      ; Close the app and continue
      !insertmacro killApp
      Goto appNotRunning
      
    cancelInstall:
      ; User chose to cancel
      MessageBox MB_OK|MB_ICONINFORMATION "Installation cancelled."
      Abort
  ${EndIf}
  
  appNotRunning:
!macroend

!macro customUnInit
  ; Close the app if it's running before uninstalling
  ${ifNot} ${isUpdated}
    !insertmacro killApp
  ${endIf}
!macroend

!macro killApp
  ; Try to close gracefully first
  DetailPrint "Checking for running application..."
  
  ; Kill the main process
  nsExec::ExecToStack 'taskkill /F /IM "Google Gemini.exe"'
  Pop $0
  Pop $1
  
  ; Give it a moment to close
  Sleep 1000
  
  ; Also kill any remaining Electron processes for this app
  nsExec::ExecToStack 'taskkill /F /FI "WINDOWTITLE eq Google Gemini*"'
  Pop $0
  Pop $1
  
  Sleep 500
!macroend
