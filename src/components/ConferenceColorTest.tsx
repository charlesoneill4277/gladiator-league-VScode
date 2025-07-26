import { Badge } from '@/components/ui/badge';
import { getConferenceBadgeClasses } from '@/utils/conferenceColors';

// Test component to verify conference badge colors
const ConferenceColorTest = () => {
  const conferences = [
    'The Legion of Mars',
    'The Legions of Mars', // Alternative name
    "Vulcan's Oathsworn",
    'The Guardians of Jupiter'
  ];

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Conference Badge Color Test</h2>
      <div className="space-y-4">
        {conferences.map((conference) => (
          <div key={conference} className="flex items-center gap-4">
            <Badge 
              variant="secondary" 
              className={getConferenceBadgeClasses(conference)}
            >
              {conference}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Conference name: {conference}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConferenceColorTest;
