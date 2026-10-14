OFFICE BIOMETRIC -> PARVA PORTAL : ONE-TIME SETUP
=================================================
(Do steps in order. Steps 1-3 are done once, on the computer where
 eTimeTrackLite is installed.)

BEFORE YOU START (done on the website side, not on the office PC)
  a) Supabase SQL Editor: run server/sql/11_biometric_punches_migration.sql
  b) Vercel -> your project -> Settings -> Environment Variables:
     add  BIOMETRIC_SYNC_KEY = (the secret key Claude gave you), then Redeploy.
  c) Map people: each employee needs their "Biometric ID" (their Employee
     Code inside eTimeTrackLite) saved in the portal. Claude will prepare
     that SQL from the employee list.

1. COPY THE FOLDER
   Copy this whole "office-bridge" folder to the office PC, for example to
   C:\ParvaBridge

2. CREATE config.json
   In C:\ParvaBridge copy config.example.json to a new file named
   config.json, open it in Notepad and fill in:
     sqlPassword = the eTimeTrack database password (the one used for user "sa")
     syncKey     = the same secret key you put in Vercel
   Never email or upload config.json -- it stays on the office PC.

3. LOOK-ONLY TEST (changes nothing)
   Right-click Start -> "Windows PowerShell", then type:
     cd C:\ParvaBridge
     powershell -ExecutionPolicy Bypass -File .\Send-Punches.ps1 -Discover
   Take a photo/screenshot of what it prints and send it to Claude.
   (It shows the table and column names. If they differ from what the script
   expects, Claude will adjust the script.)

4. FIRST REAL RUN + CATCH-UP (after Claude confirms step 3)
     powershell -ExecutionPolicy Bypass -File .\Send-Punches.ps1 -SinceDays 40
   It should print "Sent N punch(es); M attendance record(s) updated."

5. MAKE IT AUTOMATIC (every 2 minutes). In PowerShell, as Administrator:
     schtasks /create /tn "Parva Biometric Sync" /sc minute /mo 2 /ru SYSTEM /tr "powershell -NoProfile -ExecutionPolicy Bypass -File C:\ParvaBridge\Send-Punches.ps1"
   The file sync.log (same folder) records every run.

IMPORTANT
  * The PC must be switched on, and eTimeTrackLite must be receiving the
    device's punches (the dashboard showed the device as OFFLINE -- fix that
    first: check the device's network cable/Wi-Fi and its server IP setting).
  * Face/fingerprint punches show on the website within about 2 minutes.
