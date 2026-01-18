import React, { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { GOOGLE_CONFIG } from '../config/googleConfig';
import './Calendar.css';

function CalendarContent() {
  const { user } = useAuth0();
  const [events, setEvents] = useState([]);
  const [isGoogleSignedIn, setIsGoogleSignedIn] = useState(false);
  const [accessToken, setAccessToken] = useState(null);
  const [calendars, setCalendars] = useState([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState('primary');
  const [showCalendarPicker, setShowCalendarPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCreateCalendarModal, setShowCreateCalendarModal] = useState(false);
  const [creatingCalendar, setCreatingCalendar] = useState(false);

  // Restore Google Calendar session from localStorage on mount
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const savedToken = localStorage.getItem('google_calendar_token');
        const savedTokenExpiry = localStorage.getItem('google_calendar_token_expiry');
        const savedCalendarId = localStorage.getItem('google_calendar_selected_id');
        
        // Check if token exists and is not expired
        if (savedToken && savedTokenExpiry) {
          const expiryTime = parseInt(savedTokenExpiry);
          const now = Date.now();
          
          // Add a 5-minute buffer to account for clock skew and early expiration
          if (now < (expiryTime - 5 * 60 * 1000)) {
            // Token is still valid, restore session
            console.log('Restoring Google Calendar session...');
            setAccessToken(savedToken);
            setIsGoogleSignedIn(true);
            
            // Load calendars and events
            const calendarList = await loadCalendarList(savedToken);
            setCalendars(calendarList);
            
            // Only proceed if calendar list was loaded successfully
            if (calendarList.length > 0) {
              // Restore selected calendar or use PersonalCFO calendar
              let calendarToUse = savedCalendarId || 'primary';
              const personalCFOCalendar = calendarList.find(cal => cal.name === 'PersonalCFO');
              if (personalCFOCalendar) {
                calendarToUse = personalCFOCalendar.id;
              }
              
              setSelectedCalendarId(calendarToUse);
              await loadGoogleCalendar(savedToken, calendarToUse);
            } else {
              // If calendar list failed to load, clear session
              console.log('Failed to load calendar list, clearing session');
              clearGoogleSession();
              setIsGoogleSignedIn(false);
              setAccessToken(null);
            }
          } else {
            // Token expired, clear storage
            console.log('Google Calendar token expired');
            clearGoogleSession();
          }
        }
      } catch (error) {
        console.error('Error restoring Google Calendar session:', error);
        clearGoogleSession();
        setIsGoogleSignedIn(false);
        setAccessToken(null);
      }
    };
    
    restoreSession();
  }, []);

  // Helper function to clear Google session from localStorage
  const clearGoogleSession = () => {
    localStorage.removeItem('google_calendar_token');
    localStorage.removeItem('google_calendar_token_expiry');
    localStorage.removeItem('google_calendar_selected_id');
  };

  // Save token to localStorage when it changes
  useEffect(() => {
    if (accessToken && isGoogleSignedIn) {
      localStorage.setItem('google_calendar_token', accessToken);
      // Google tokens typically expire in 1 hour, store expiry time
      const expiryTime = Date.now() + (3600 * 1000); // 1 hour from now
      localStorage.setItem('google_calendar_token_expiry', expiryTime.toString());
    }
  }, [accessToken, isGoogleSignedIn]);

  // Save selected calendar ID when it changes
  useEffect(() => {
    if (selectedCalendarId) {
      localStorage.setItem('google_calendar_selected_id', selectedCalendarId);
    }
  }, [selectedCalendarId]);

  // Create a new PersonalCFO calendar
  const createPersonalCFOCalendar = async (token) => {
    try {
      setCreatingCalendar(true);
      console.log('Creating PersonalCFO calendar...');
      
      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            summary: 'PersonalCFO',
            description: 'Calendar for PersonalCFO business management',
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        }
      );

      if (response.ok) {
        const newCalendar = await response.json();
        console.log('PersonalCFO calendar created:', newCalendar);
        
        // Reload calendar list to include the new calendar
        const updatedCalendarList = await loadCalendarList(token);
        setCalendars(updatedCalendarList);
        
        // Set the new calendar as selected
        setSelectedCalendarId(newCalendar.id);
        
        // Load events from the new calendar (will be empty initially)
        await loadGoogleCalendar(token, newCalendar.id);
        
        return newCalendar.id;
      } else {
        const errorData = await response.json();
        console.error('Error creating calendar:', errorData);
        alert('Failed to create PersonalCFO calendar. Please try again.');
        return null;
      }
    } catch (error) {
      console.error('Error creating PersonalCFO calendar:', error);
      alert('Failed to create PersonalCFO calendar. Please try again.');
      return null;
    } finally {
      setCreatingCalendar(false);
      setShowCreateCalendarModal(false);
    }
  };

  const handleCreateCalendarYes = async () => {
    if (accessToken) {
      await createPersonalCFOCalendar(accessToken);
    }
  };

  const handleCreateCalendarNo = async () => {
    setShowCreateCalendarModal(false);
    // Use primary calendar by default
    setSelectedCalendarId('primary');
    if (accessToken) {
      await loadGoogleCalendar(accessToken, 'primary');
    }
  };
  const loadCalendarList = async (token) => {
    try {
      console.log('Fetching calendar list...');
      
      // Check if token is expired before making the request
      const savedTokenExpiry = localStorage.getItem('google_calendar_token_expiry');
      if (savedTokenExpiry && Date.now() > parseInt(savedTokenExpiry)) {
        console.log('Token expired, clearing session');
        clearGoogleSession();
        setIsGoogleSignedIn(false);
        setAccessToken(null);
        return [];
      }
      
      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/users/me/calendarList',
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('Calendar list:', data);
        const calendarList = data.items?.map(cal => ({
          id: cal.id,
          name: cal.summary,
          color: cal.backgroundColor,
          primary: cal.primary || false,
        })) || [];
        
        console.log('Formatted calendar list:', calendarList);
        setCalendars(calendarList);
        return calendarList;
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Error fetching calendar list:', errorData);
        
        // Check if it's an authentication error
        if (response.status === 401 || errorData.error?.message?.includes('invalid authentication')) {
          console.log('Authentication error detected, clearing session');
          clearGoogleSession();
          setIsGoogleSignedIn(false);
          setAccessToken(null);
        }
        
        return [];
      }
    } catch (error) {
      console.error('Error loading calendar list:', error);
      return [];
    }
  };

  // Initialize Google Calendar API
  const loadGoogleCalendar = async (token, calendarId = 'primary') => {
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching events for calendar:', calendarId);
      
      // Check if token is expired before making the request
      const savedTokenExpiry = localStorage.getItem('google_calendar_token_expiry');
      if (savedTokenExpiry && Date.now() > parseInt(savedTokenExpiry)) {
        console.log('Token expired, clearing session');
        clearGoogleSession();
        setIsGoogleSignedIn(false);
        setAccessToken(null);
        setError('Your Google Calendar session has expired. Please reconnect.');
        setLoading(false);
        return;
      }
      
      // Get events from 6 months ago to 6 months in the future
      const timeMin = new Date();
      timeMin.setMonth(timeMin.getMonth() - 6);
      const timeMax = new Date();
      timeMax.setMonth(timeMax.getMonth() + 6);
      
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` +
        `maxResults=250&` +
        `singleEvents=true&` +
        `orderBy=startTime&` +
        `timeMin=${timeMin.toISOString()}&` +
        `timeMax=${timeMax.toISOString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log('Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Events data:', data);
        console.log('Number of events:', data.items?.length || 0);
        
        const selectedCal = calendars.find(c => c.id === calendarId);
        const formattedEvents = data.items?.map(event => ({
          id: event.id,
          title: event.summary || 'No Title',
          start: event.start.dateTime || event.start.date,
          end: event.end.dateTime || event.end.date,
          allDay: !event.start.dateTime,
          backgroundColor: selectedCal?.color || '#4285f4',
          borderColor: selectedCal?.color || '#4285f4',
          extendedProps: {
            description: event.description,
            location: event.location,
          }
        })) || [];
        
        console.log('Formatted events:', formattedEvents);
        setEvents(formattedEvents);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Error response:', errorData);
        
        // Check if it's an authentication error
        if (response.status === 401 || errorData.error?.message?.includes('invalid authentication')) {
          console.log('Authentication error detected, clearing session');
          clearGoogleSession();
          setIsGoogleSignedIn(false);
          setAccessToken(null);
          setError('Your Google Calendar session has expired. Please reconnect by clicking "Connect Google Calendar".');
        } else {
          setError(`Failed to load events: ${errorData.error?.message || 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error('Error loading Google Calendar events:', error);
      setError('Failed to load calendar events. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Load events when calendar selection changes
  useEffect(() => {
    if (accessToken && selectedCalendarId && calendars.length > 0) {
      loadGoogleCalendar(accessToken, selectedCalendarId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCalendarId, accessToken, calendars]);

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      console.log('Google login successful, token:', tokenResponse.access_token ? 'exists' : 'missing');
      setAccessToken(tokenResponse.access_token);
      setIsGoogleSignedIn(true);
      
      const calendarList = await loadCalendarList(tokenResponse.access_token);
      setCalendars(calendarList);
      
      // Check if PersonalCFO calendar already exists
      const personalCFOCalendar = calendarList.find(cal => 
        cal.name === 'PersonalCFO'
      );
      
      if (personalCFOCalendar) {
        // PersonalCFO calendar exists, use it
        console.log('PersonalCFO calendar already exists:', personalCFOCalendar.id);
        setSelectedCalendarId(personalCFOCalendar.id);
        await loadGoogleCalendar(tokenResponse.access_token, personalCFOCalendar.id);
      } else {
        // Show modal to ask if user wants to create PersonalCFO calendar
        setShowCreateCalendarModal(true);
      }
    },
    onError: (error) => {
      console.error('Google login failed:', error);
      alert('Failed to connect to Google Calendar. Please check your credentials and try again.');
    },
    scope: GOOGLE_CONFIG.scope,
    flow: 'implicit', // Use implicit flow for better compatibility
  });

  const handleDateClick = (arg) => {
    if (!isGoogleSignedIn) {
      alert('Please sign in with Google Calendar first');
      return;
    }
    console.log('Date clicked:', arg.dateStr);
    // We'll implement event creation later
  };

  const handleEventClick = (clickInfo) => {
    console.log('Event clicked:', clickInfo.event);
    // We'll implement event details/editing later
  };

  const handleGoogleSignIn = () => {
    googleLogin();
  };

  const handleGoogleSignOut = () => {
    setIsGoogleSignedIn(false);
    setAccessToken(null);
    setEvents([]);
    setCalendars([]);
    setSelectedCalendarId('primary');
    clearGoogleSession();
  };

  const handleCalendarChange = (calendarId) => {
    setSelectedCalendarId(calendarId);
    setShowCalendarPicker(false);
  };

  const getSelectedCalendarName = () => {
    const selected = calendars.find(cal => cal.id === selectedCalendarId);
    return selected?.name || 'Select Calendar';
  };

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <div className="header-content">
          <h1> Calendar</h1>
          <p className="subtitle">View and manage your Google Calendar</p>
        </div>
        <div className="header-actions">
          {!isGoogleSignedIn ? (
            <button className="google-signin-btn" onClick={handleGoogleSignIn}>
              <span></span>
              Connect Google Calendar
            </button>
          ) : (
            <>
              <div className="calendar-picker-wrapper">
                <button 
                  className="calendar-picker-btn"
                  onClick={() => setShowCalendarPicker(!showCalendarPicker)}
                >
                  <span></span>
                  {getSelectedCalendarName()}
                  <span className="dropdown-arrow">▼</span>
                </button>
                
                {showCalendarPicker && (
                  <div className="calendar-picker-dropdown">
                    {calendars.map((calendar) => (
                      <button
                        key={calendar.id}
                        className={`calendar-option ${calendar.id === selectedCalendarId ? 'selected' : ''}`}
                        onClick={() => handleCalendarChange(calendar.id)}
                      >
                        <span 
                          className="calendar-color-dot"
                          style={{ backgroundColor: calendar.color }}
                        />
                        <span className="calendar-name">{calendar.name}</span>
                        {calendar.primary && <span className="primary-badge">Primary</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <button className="google-signout-btn" onClick={handleGoogleSignOut}>
                <span>Disconnect</span>
                
              </button>
            </>
          )}
        </div>
      </div>

      {/* Close dropdown when clicking outside */}
      {showCalendarPicker && (
        <div 
          className="calendar-picker-overlay"
          onClick={() => setShowCalendarPicker(false)}
        />
      )}

      {/* Create Calendar Modal */}
      {showCreateCalendarModal && (
        <div className="modal-overlay">
          <div className="create-calendar-modal">
            <div className="modal-icon"></div>
            <h2>Create PersonalCFO Calendar?</h2>
            <p>
              Would you like to create a dedicated calendar for PersonalCFO?
              This will help keep your business events organized separately.
            </p>
            <div className="modal-actions">
              <button 
                className="modal-btn secondary"
                onClick={handleCreateCalendarNo}
                disabled={creatingCalendar}
              >
                No, use my primary calendar
              </button>
              <button 
                className="modal-btn primary"
                onClick={handleCreateCalendarYes}
                disabled={creatingCalendar}
              >
                {creatingCalendar ? (
                  <>
                    <span className="btn-spinner"></span>
                    Creating...
                  </>
                ) : (
                  <>Yes, create it</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {!isGoogleSignedIn ? (
        <div className="calendar-content empty-state">
          <div className="google-signin-prompt">
            <div className="prompt-icon"></div>
            <h3>Connect Your Google Calendar</h3>
            <p>Sign in with Google to view and manage your calendar events</p>
            <button className="google-signin-btn-large" onClick={handleGoogleSignIn}>
              <span>🔗</span>
              Connect Google Calendar
            </button>
          </div>
        </div>
      ) : (
        <div className="calendar-content">
          {error && (
            <div className="calendar-error-banner">
              <span>⚠️</span>
              {error}
            </div>
          )}
          {loading && (
            <div className="calendar-loading-overlay">
              <div className="spinner"></div>
              <p>Loading events...</p>
            </div>
          )}
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay'
            }}
            events={events}
            editable={true}
            selectable={true}
            selectMirror={true}
            dayMaxEvents={true}
            weekends={true}
            dateClick={handleDateClick}
            eventClick={handleEventClick}
            height="auto"
          />
        </div>
      )}
    </div>
  );
}

function Calendar() {
  const clientId = GOOGLE_CONFIG.clientId;

  if (!clientId) {
    return (
      <div className="calendar-container">
        <div className="calendar-header">
          <h1> Calendar</h1>
        </div>
        <div className="calendar-content error-state">
          <div className="error-message">
            <h3>⚠️ Configuration Required</h3>
            <p>Please set up your Google Calendar API credentials:</p>
            <ol>
              <li>Create a <code>.env</code> file in the frontend directory</li>
              <li>Add your credentials:
                <pre>
{`VITE_GOOGLE_CLIENT_ID=your_client_id
VITE_GOOGLE_API_KEY=your_api_key`}
                </pre>
              </li>
              <li>Restart the development server</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <CalendarContent />
    </GoogleOAuthProvider>
  );
}

export default Calendar;
