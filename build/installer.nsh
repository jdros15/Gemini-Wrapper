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
  nsExec::ExecToStack 'taskkill /F /IM "Gemini Wrapper.exe"'
  Pop $0
  Pop $1
  
  ; Give it a moment to close
  Sleep 1000
  
  ; Also kill any remaining Electron processes for this app
  nsExec::ExecToStack 'taskkill /F /FI "WINDOWTITLE eq Gemini Wrapper*"'
  Pop $0
  Pop $1
  
  Sleep 500
!macroend
