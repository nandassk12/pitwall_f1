/**
 * Dynamically queries the Wikipedia API to retrieve a driver headshot/thumbnail.
 * F1 driver wikipedia pages are highly detailed and contain standard media infobox images,
 * making this extremely reliable across all historical seasons.
 */
export async function getDriverHeadshot(driverFullName) {
  if (!driverFullName) return null;
  
  // Format the name for Wikipedia: replace spaces with underscores, e.g. "Max_Verstappen"
  const formattedName = encodeURIComponent(driverFullName.trim().replace(/ /g, '_'));
  
  try {
    const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${formattedName}`);
    if (!response.ok) return null;
    
    const data = await response.json();
    // Return thumbnail or original image source if available
    return data.thumbnail?.source || data.originalimage?.source || null;
  } catch (error) {
    console.error(`Wikipedia API headshot lookup failed for ${driverFullName}:`, error);
    return null;
  }
}
