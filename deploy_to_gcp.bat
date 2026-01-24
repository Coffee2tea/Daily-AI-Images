@echo off
echo ========================================================
echo   Google Cloud Run Deployment Automation
echo ========================================================
echo.

:: Check if gcloud is installed
where gcloud >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Google Cloud SDK is NOT installed.
    echo.
    echo I cannot install system software for you.
    echo Please download and install it manually:
    echo https://cloud.google.com/sdk/docs/install#windows
    echo.
    echo Once installed, run "gcloud init" to log in, then run this script again.
    pause
    exit /b 1
)

:: Check if user is logged in (basic check)
call gcloud auth print-identity-token >nul 2>nul
if %errorlevel% neq 0 (
    echo [WARNING] You do not seem to be logged in.
    echo Please log in now...
    call gcloud auth login
)

echo.
echo [1/3] Enabling Google Cloud Services...
call gcloud services enable run.googleapis.com
call gcloud services enable cloudbuild.googleapis.com

echo.
echo [2/3] Building and Deploying to Cloud Run...
echo This may take a few minutes...
call gcloud run deploy daily-ai-images --source . --port 3000 --allow-unauthenticated --region us-central1

echo.
echo [3/3] Deployment process finished.
echo If successful, you should see a URL above.
echo.
echo Don't forget to set your environment variables in the Cloud Console!
echo https://console.cloud.google.com/run
echo.
pause
