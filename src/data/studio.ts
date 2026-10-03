import { games, totalMissions } from './games';
import { courses } from './classes';
import { badges } from '../systems/progress';
import release from './release.json';

export const studio = Object.freeze({ version: release.version, major: release.major, worlds: games.length, classes: courses.length, slots: totalMissions, badges: badges.length });
export const studioDescription = `Play smarter. Live smarter. ${studio.worlds} free game worlds, ${studio.classes} hands-on classes, and a local agent simulation lab. Explore practical skills, STEM, building, and survival. No account needed for local play.`;
