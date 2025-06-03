import { ConferenceMapping } from '@/services/conferenceService';

/**
 * Utility functions for conference operations
 */

/**
 * Find conference by name with fuzzy matching
 */
export const findConferenceByName = (
  conferences: ConferenceMapping[], 
  conferenceName: string
): ConferenceMapping | undefined => {
  if (!conferences || !conferenceName) return undefined;

  // Exact match first
  let found = conferences.find(c => c.name === conferenceName);
  if (found) return found;

  // Try case-insensitive match
  const lowerSearchName = conferenceName.toLowerCase();
  found = conferences.find(c => c.name.toLowerCase() === lowerSearchName);
  if (found) return found;

  // Try partial match
  found = conferences.find(c => 
    c.name.toLowerCase().includes(lowerSearchName) || 
    lowerSearchName.includes(c.name.toLowerCase())
  );
  
  return found;
};

/**
 * Validate league ID format
 */
export const isValidLeagueId = (leagueId: string): boolean => {
  if (!leagueId || typeof leagueId !== 'string') return false;
  
  // Basic validation - league IDs should be non-empty strings
  // You can add more specific validation based on your league ID format
  return leagueId.trim().length > 0;
};

/**
 * Get conference display info with fallbacks
 */
export const getConferenceDisplayInfo = (
  conferences: ConferenceMapping[],
  conferenceId: string | null,
  fallbackName: string = 'Unknown Conference'
): { name: string; leagueId?: string; id?: string } => {
  if (!conferenceId) {
    return { name: 'All Conferences' };
  }

  const conference = conferences.find(c => c.id === conferenceId);
  if (!conference) {
    return { name: fallbackName, id: conferenceId };
  }

  return {
    name: conference.name,
    leagueId: conference.leagueId,
    id: conference.id
  };
};

/**
 * Group conferences by status
 */
export const groupConferencesByStatus = (conferences: ConferenceMapping[]) => {
  return conferences.reduce((groups, conference) => {
    const status = conference.status || 'unknown';
    if (!groups[status]) {
      groups[status] = [];
    }
    groups[status].push(conference);
    return groups;
  }, {} as Record<string, ConferenceMapping[]>);
};

/**
 * Sort conferences by name
 */
export const sortConferencesByName = (conferences: ConferenceMapping[]): ConferenceMapping[] => {
  return [...conferences].sort((a, b) => a.name.localeCompare(b.name));
};

/**
 * Format conference name for display
 */
export const formatConferenceName = (name: string): string => {
  if (!name) return '';
  
  // Capitalize first letter of each word
  return name.replace(/\b\w/g, l => l.toUpperCase());
};