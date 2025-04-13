import json
import os
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

# Constants - update these with your values
SPREADSHEET_ID = '1oQhNGbuzad2XC9kQwXu2CswaHlxLHhHKgngz1wA9iRo'
DRIVE_FOLDER_ID = '1P4f1lx9w5ay-3Dw4JO3qzjGN8ysTvGt5'
SERVICE_ACCOUNT_FILE = 'lodge-service-account.json'
SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 
          'https://www.googleapis.com/auth/drive']

# Initialize Google API services
def get_google_services():
    try:
        credentials = service_account.Credentials.from_service_account_file(
            SERVICE_ACCOUNT_FILE, scopes=SCOPES)
        sheets_service = build('sheets', 'v4', credentials=credentials)
        drive_service = build('drive', 'v3', credentials=credentials)
        return sheets_service, drive_service
    except Exception as e:
        print(f"Error initializing Google services: {str(e)}")
        return None, None

# Read all rooms data from Google Sheets
def get_rooms_data():
    sheets_service, _ = get_google_services()
    if not sheets_service:
        return {}
    
    try:
        result = sheets_service.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID, range='Rooms!A2:F100').execute()
        values = result.get('values', [])
        
        rooms_dict = {}
        for row in values:
            if len(row) >= 1:
                room_number = row[0]
                rooms_dict[room_number] = {
                    "status": row[1] if len(row) > 1 else "vacant",
                    "guest": json.loads(row[2]) if len(row) > 2 and row[2] else None,
                    "checkin_time": row[3] if len(row) > 3 else None,
                    "balance": int(row[4]) if len(row) > 4 and row[4] else 0,
                    "add_ons": json.loads(row[5]) if len(row) > 5 and row[5] else []
                }
        return rooms_dict
    except Exception as e:
        print(f"Error reading rooms data: {str(e)}")
        return {}

# Read logs data from Google Sheets
def get_logs_data():
    sheets_service, _ = get_google_services()
    if not sheets_service:
        return {}
    
    try:
        result = sheets_service.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID, range='Logs!A2:G1000').execute()
        values = result.get('values', [])
        
        logs = {
            "cash": [],
            "online": [],
            "balance": [],
            "add_ons": [],
            "refunds": [],
            "renewals": [],
            "booking_payments": []
        }
        
        for row in values:
            if len(row) >= 6:
                log_type = row[0]
                if log_type in logs:
                    log_entry = {
                        "room": row[1],
                        "name": row[2],
                        "amount": int(row[3]) if row[3].isdigit() else 0,
                        "time": row[4],
                        "date": row[5]
                    }
                    if len(row) > 6:
                        log_entry["notes"] = row[6]
                    logs[log_type].append(log_entry)
        
        return logs
    except Exception as e:
        print(f"Error reading logs data: {str(e)}")
        return {key: [] for key in ["cash", "online", "balance", "add_ons", "refunds", "renewals", "booking_payments"]}

# Read totals data from Google Sheets
def get_totals_data():
    sheets_service, _ = get_google_services()
    if not sheets_service:
        return {}
    
    try:
        result = sheets_service.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID, range='Totals!A2:B10').execute()
        values = result.get('values', [])
        
        totals = {
            "cash": 0,
            "online": 0,
            "balance": 0,
            "refunds": 0,
            "advance_bookings": 0
        }
        
        for row in values:
            if len(row) >= 2 and row[0] in totals:
                totals[row[0]] = int(row[1]) if row[1].isdigit() else 0
        
        return totals
    except Exception as e:
        print(f"Error reading totals data: {str(e)}")
        return totals

# Read bookings data from Google Sheets
def get_bookings_data():
    sheets_service, _ = get_google_services()
    if not sheets_service:
        return {}
    
    try:
        result = sheets_service.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID, range='Bookings!A2:M1000').execute()
        values = result.get('values', [])
        
        bookings = {}
        for row in values:
            if len(row) >= 7:
                booking_id = row[0]
                bookings[booking_id] = {
                    "room": row[1],
                    "guest_name": row[2],
                    "guest_mobile": row[3],
                    "check_in_date": row[4],
                    "check_out_date": row[5],
                    "status": row[6],
                    "total_amount": int(row[7]) if len(row) > 7 and row[7].isdigit() else 0,
                    "paid_amount": int(row[8]) if len(row) > 8 and row[8].isdigit() else 0,
                    "balance": int(row[9]) if len(row) > 9 and row[9].isdigit() else 0,
                    "payment_method": row[10] if len(row) > 10 else "cash",
                    "notes": row[11] if len(row) > 11 else "",
                    "photo_path": row[12] if len(row) > 12 else None
                }
        return bookings
    except Exception as e:
        print(f"Error reading bookings data: {str(e)}")
        return {}

# Update rooms data in Google Sheets
def update_rooms_data(rooms_dict):
    sheets_service, _ = get_google_services()
    if not sheets_service:
        return False
    
    try:
        values = []
        for room_number, room_data in rooms_dict.items():
            values.append([
                room_number,
                room_data["status"],
                json.dumps(room_data["guest"]) if room_data["guest"] else "",
                room_data["checkin_time"] if room_data["checkin_time"] else "",
                str(room_data["balance"]),
                json.dumps(room_data["add_ons"]) if room_data["add_ons"] else ""
            ])
        
        body = {"values": values}
        sheets_service.spreadsheets().values().update(
            spreadsheetId=SPREADSHEET_ID, range='Rooms!A2',
            valueInputOption='RAW', body=body).execute()
        return True
    except Exception as e:
        print(f"Error updating rooms data: {str(e)}")
        return False

# Upload file to Google Drive
def upload_file_to_drive(file_path, file_name):
    _, drive_service = get_google_services()
    if not drive_service:
        return None
    
    try:
        file_metadata = {
            'name': file_name,
            'parents': [DRIVE_FOLDER_ID]
        }
        media = MediaFileUpload(file_path, resumable=True)
        file = drive_service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id,webContentLink').execute()
        
        # Make file publicly accessible
        permission = {
            'type': 'anyone',
            'role': 'reader'
        }
        drive_service.permissions().create(
            fileId=file.get('id'),
            body=permission).execute()
        
        return file.get('webContentLink')
    except Exception as e:
        print(f"Error uploading file to Drive: {str(e)}")
        return None