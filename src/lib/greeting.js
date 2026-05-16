export function getGreetingParts(date = new Date()) {
  const hour = date.getHours();

  if (hour >= 5 && hour < 12) {
    return { lead: 'Good morning,', tail: '.' };
  }

  if (hour >= 12 && hour < 17) {
    return { lead: 'Good afternoon,', tail: '.' };
  }

  if (hour >= 17 && hour < 23) {
    return { lead: 'Good evening,', tail: '.' };
  }

  return { lead: "It's too fucking late,", tail: '. Go to bed.' };
}
