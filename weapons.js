// Datos compartidos cliente/servidor. El servidor usa dmg/head/cd para validar;
// el cliente usa el resto (dispersión, FOV de ADS, cargador...).
export const BASE_FOV = 85;
export const MAX_HP = 100;
export const ROUNDS = 5;

export const WEAPONS = {
  pistol: { name: 'DESERT-X', dmg: 52, head: 2,   cd: 0.38,  auto: false, mag: 7,  reload: 1.4, hip: 0.022, ads: 0.002, fov: 68, adsMove: 0.8,  recoil: 0.045 },
  sniper: { name: 'LONGSHOT', dmg: 85, head: 2,   cd: 1.3,   auto: false, mag: 5,  reload: 2.4, hip: 0.09,  ads: 0,     fov: 18, adsMove: 0.5,  recoil: 0.12  },
  rifle:  { name: 'ASR-9',    dmg: 14, head: 1.8, cd: 0.095, auto: true,  mag: 30, reload: 2.0, hip: 0.04,  ads: 0.006, fov: 62, adsMove: 0.75, recoil: 0.012 },
};
