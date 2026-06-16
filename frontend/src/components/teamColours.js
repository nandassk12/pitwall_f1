export const TEAM_COLORS = {
  "Red Bull Racing":        "#3671C6",
  "Red Bull":               "#3671C6",
  "Ferrari":                "#E8002D",
  "Mercedes":               "#27F4D2",
  "McLaren":                "#FF8000",
  "Aston Martin":           "#229971",
  "Alpine":                 "#FF87BC",
  "Williams":               "#64C4FF",
  "AlphaTauri":             "#6692FF",
  "Alfa Romeo":             "#C92D4B",
  "Haas F1 Team":           "#B6BABD",
  "Haas":                   "#B6BABD",
  "RB":                     "#6692FF",
  "Kick Sauber":            "#52E252",
  "Visa Cash App RB":       "#6692FF",
  "Sauber":                 "#52E252",
};

export const getTeamColor = (teamName) => {
  if (!teamName) return "#888899";
  for (const [key, value] of Object.entries(TEAM_COLORS)) {
    if (teamName.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(teamName.toLowerCase())) {
      return value;
    }
  }
  return "#888899";
};
