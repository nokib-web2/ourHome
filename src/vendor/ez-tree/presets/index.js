import ashMedium from './ash_medium.json';
import ashLarge from './ash_large.json';
import aspenMedium from './aspen_medium.json';
import bush1 from './bush_1.json';
import bush2 from './bush_2.json';
import bush3 from './bush_3.json';
import oakMedium from './oak_medium.json';
import oakLarge from './oak_large.json';
import trellis from './trellis.json';
import TreeOptions from '../options';

// Trimmed from ez-tree (MIT): only the presets this site uses.
export const TreePreset = {
  'Ash Medium': ashMedium,
  'Ash Large': ashLarge,
  'Aspen Medium': aspenMedium,
  'Bush 1': bush1,
  'Bush 2': bush2,
  'Bush 3': bush3,
  'Oak Medium': oakMedium,
  'Oak Large': oakLarge,
  Trellis: trellis,
};

export function loadPreset(name) {
  const preset = TreePreset[name];
  return preset ? structuredClone(preset) : new TreeOptions();
}
