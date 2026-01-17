# Google Calendar Integration Setup

This guide will help you set up Google Calendar integration for your PersonalCFO app.

## Prerequisites

You mentioned you already have your Google OAuth credentials (Client ID and API Key). Great! Let's configure them.

## Setup Instructions

### 1. Create Environment File

Create a `.env` file in the `frontend/` directory with your Google credentials:

```bash
cd frontend
touch .env  # On Windows: type nul > .env
```

### 2. Add Your Credentials

Add the following to your `.env` file:

```env
VITE_GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
VITE_GOOGLE_API_KEY=your_api_key_here
```

Replace:
- `your_client_id_here.apps.googleusercontent.com` with your actual Google Client ID
- `your_api_key_here` with your actual Google API Key

### 3. Configure OAuth Consent Screen (If Not Already Done)

Make sure your Google Cloud Console OAuth consent screen is configured:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services** > **OAuth consent screen**
4. Add your app's authorized domains
5. Add the following scope:
   - `https://www.googleapis.com/auth/calendar` (Read/write access to Calendar)

### 4. Configure Authorized Redirect URIs

In Google Cloud Console:

1. Go to **APIs & Services** > **Credentials**
2. Click on your OAuth 2.0 Client ID
3. Add authorized JavaScript origins:
   - `http://localhost:5173` (for development)
   - Your production URL (when deploying)
4. Add authorized redirect URIs:
   - `http://localhost:5173`
   - Your production URL

### 5. Enable Google Calendar API

Make sure the Calendar API is enabled:

1. Go to **APIs & Services** > **Library**
2. Search for "Google Calendar API"
3. Click **Enable**

### 6. Restart Development Server

After adding credentials, restart your dev server:

```bash
npm run dev
```

## How It Works

### Features Implemented:

1. **Google Sign-In**: Users can connect their Google Calendar account
2. **View Events**: All Google Calendar events are fetched and displayed in FullCalendar
3. **Month/Week/Day Views**: Switch between different calendar views
4. **Sign Out**: Disconnect from Google Calendar

### User Flow:

1. User navigates to Calendar page
2. Clicks "Connect Google Calendar" button
3. Google OAuth popup appears
4. User grants calendar permissions
5. Events are loaded and displayed in the calendar
6. User can view events in month/week/day views
7. User can disconnect by clicking "Disconnect"

## Security Notes

- **Never commit `.env` files** to version control
- The `.env` file is already in `.gitignore`
- Keep your API keys and Client IDs secure
- Only share credentials through secure channels

## Troubleshooting

### "Configuration Required" Error
- Make sure `.env` file exists in `frontend/` directory
- Check that variable names are correct (must start with `VITE_`)
- Restart the development server after creating/editing `.env`

### OAuth Errors
- Verify redirect URIs match exactly in Google Cloud Console
- Check that Calendar API is enabled
- Ensure OAuth consent screen is properly configured

### Events Not Loading
- Check browser console for errors
- Verify API scopes in Google Cloud Console
- Ensure user granted calendar permissions

## Next Steps

Future enhancements to add:
- Create new events from the calendar
- Edit existing events
- Delete events
- Event details modal
- Multiple calendar support
- Color-coded events by calendar

## Resources

- [Google Calendar API Documentation](https://developers.google.com/calendar)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [FullCalendar Documentation](https://fullcalendar.io/docs)
