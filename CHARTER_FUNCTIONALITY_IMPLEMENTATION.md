# Charter Upload and Viewing Functionality

## Overview
Implemented a complete charter document management system that allows administrators to upload league charter documents through the admin panel and makes them viewable on the League Rules page. The solution uses Supabase Storage for secure file management with proper access controls.

## Architecture

### 1. **Supabase Storage Integration**
- Uses Supabase Storage buckets for secure file storage
- Supports PDF, DOC, DOCX, and TXT file formats
- 10MB file size limit
- Public read access for viewing, admin-only write access

### 2. **Database Schema Updates**
Added charter-related fields to the `seasons` table:
- `charter_file_url`: URL to the charter document in Supabase Storage
- `charter_file_name`: Original filename of uploaded charter
- `charter_uploaded_at`: Timestamp when charter was uploaded
- `charter_uploaded_by`: User ID of admin who uploaded charter

### 3. **Service Layer**
- **CharterService**: Handles file upload, deletion, and validation
- **Database integration**: Updates season records with charter metadata
- **File validation**: Type checking, size limits, and security

## Implementation Details

### Database Migration
```sql
-- Run add-charter-fields.sql
ALTER TABLE seasons 
ADD COLUMN IF NOT EXISTS charter_file_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS charter_file_name TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS charter_uploaded_at TIMESTAMP DEFAULT NULL,
ADD COLUMN IF NOT EXISTS charter_uploaded_by TEXT DEFAULT NULL;
```

### Key Components Created

#### 1. CharterService (`src/services/charterService.ts`)
- **File Upload**: Secure upload to Supabase Storage with validation
- **File Management**: Delete, retrieve, and manage charter documents
- **Validation**: File type, size, and security checks
- **Metadata Management**: Updates database with file information

#### 2. useCharter Hook (`src/hooks/useCharter.ts`)
- **Season-aware**: Automatically updates when season filter changes
- **Loading States**: Handles loading and error states
- **Real-time Updates**: Refetches data when charter is uploaded/deleted

#### 3. CharterUpload Component (`src/components/admin/CharterUpload.tsx`)
- **Admin Interface**: Full-featured upload interface for administrators
- **File Preview**: Shows selected file information before upload
- **Progress Tracking**: Visual upload progress indicator
- **Current Charter Display**: Shows existing charter with view/delete options
- **Error Handling**: Comprehensive error messages and validation

#### 4. Updated Charter Tab (`src/pages/LeagueRulesPage.tsx`)
- **Dynamic Display**: Shows charter if available, placeholder if not
- **File Actions**: View and download buttons for charter documents
- **Season Responsive**: Updates automatically with season filter
- **Professional Presentation**: Clean, user-friendly interface

## Features

### For Administrators
- **Secure Upload**: Upload charter documents through admin panel
- **File Management**: Replace or delete existing charters
- **Validation Feedback**: Clear error messages for invalid files
- **Upload Progress**: Visual progress indicator during upload
- **File Preview**: See file details before uploading

### For League Members
- **Easy Access**: View charter directly from League Rules page
- **Download Option**: Download charter for offline viewing
- **File Information**: See when charter was last updated
- **Responsive Design**: Works on all device sizes

### Technical Features
- **File Type Support**: PDF, Word documents, text files
- **Size Limits**: 10MB maximum file size
- **Security**: Admin-only upload, public read access
- **Storage Optimization**: Automatic file cleanup on replacement
- **Error Recovery**: Graceful handling of upload failures

## File Flow

### Upload Process
1. Admin selects file in admin panel
2. File validation (type, size, format)
3. Upload to Supabase Storage bucket
4. Generate public URL for file access
5. Update season record with charter metadata
6. Cleanup on failure (remove uploaded file)

### Viewing Process
1. User visits League Rules Charter tab
2. Hook fetches charter info for selected season
3. Display charter with view/download options
4. Handle missing charter gracefully

## Security Considerations

### Access Control
- **Upload**: Admin-only through admin panel
- **View**: Public read access for league members
- **Storage**: Supabase Storage with proper bucket policies

### File Validation
- **Type Checking**: Only allowed file types accepted
- **Size Limits**: 10MB maximum to prevent abuse
- **Sanitization**: Secure filename generation

### Error Handling
- **Upload Failures**: Automatic cleanup of partial uploads
- **Database Errors**: Rollback file uploads on database failures
- **User Feedback**: Clear error messages without exposing internals

## Usage Instructions

### For Administrators
1. Navigate to Admin Panel
2. Go to Charter Upload section
3. Select charter document (PDF, DOC, DOCX, TXT)
4. Click Upload button
5. Monitor progress and confirm success
6. Charter is immediately available on League Rules page

### For League Members
1. Go to League Rules page
2. Click Charter tab
3. View charter document in browser or download
4. Charter updates automatically when admin uploads new version

## Benefits

1. **Centralized Management**: Single location for charter documents
2. **Version Control**: Automatic tracking of upload dates and admins
3. **Easy Access**: Simple viewing and downloading for all members
4. **Professional Presentation**: Clean, organized display
5. **Secure Storage**: Proper access controls and file validation
6. **Season Awareness**: Charter documents per season
7. **Mobile Friendly**: Responsive design for all devices

## Future Enhancements

- **Version History**: Track multiple versions of charter documents
- **Approval Workflow**: Multi-step approval process for charter changes
- **Notifications**: Alert members when charter is updated
- **Comments System**: Allow feedback on charter documents
- **Advanced Permissions**: Role-based access controls
- **Document Preview**: In-browser PDF preview without download

## Technical Stack

- **Frontend**: React with TypeScript
- **Storage**: Supabase Storage
- **Database**: PostgreSQL (Supabase)
- **File Handling**: Native File API
- **UI Components**: Custom components with Tailwind CSS
- **State Management**: React hooks with context