// Conference color schemes for badges and UI elements
export interface ConferenceColors {
  primary: string;
  secondary: string;
  accent: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
}

export const getConferenceColors = (conferenceName: string): ConferenceColors => {
  switch (conferenceName) {
    case 'The Legion of Mars':
    case 'The Legions of Mars':
      return {
        primary: '#800020', // Burgundy Wine Red
        secondary: '#CD7F32', // Ember Copper
        accent: '#FF7F7F', // Bright Coral
        bgClass: 'bg-[#800020]',
        textClass: 'text-white',
        borderClass: 'border-[#CD7F32]'
      };

    case "Vulcan's Oathsworn":
      return {
        primary: '#708090', // Slate Gray
        secondary: '#CD7F32', // Bronze Gold
        accent: '#CF1020', // Lava Red
        bgClass: 'bg-[#708090]',
        textClass: 'text-white',
        borderClass: 'border-[#CD7F32]'
      };

    case 'The Guardians of Jupiter':
      return {
        primary: '#483D8B', // Storm Purple
        secondary: '#9370DB', // Nebula Violet
        accent: '#DAA520', // Jupiter Gold
        bgClass: 'bg-[#483D8B]',
        textClass: 'text-white',
        borderClass: 'border-[#DAA520]'
      };

    default:
      // Default fallback styling
      return {
        primary: '#6B7280', // Gray
        secondary: '#9CA3AF',
        accent: '#3B82F6',
        bgClass: 'bg-gray-500',
        textClass: 'text-white',
        borderClass: 'border-gray-300'
      };
  }
};

export const getConferenceBadgeClasses = (conferenceName: string): string => {
  const colors = getConferenceColors(conferenceName);
  return `${colors.bgClass} ${colors.textClass} ${colors.borderClass} border-2 font-semibold`;
};
