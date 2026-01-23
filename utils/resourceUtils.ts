import { Stage, ResourceType } from '../types';

export const getResourceCapacity = (stage: Stage, resource: ResourceType): number => {
  if (stage === Stage.PRIMARY) {
    return 25; // Aula de Idiomas
  }
  if (resource === 'CART') {
    return 11; // Carro
  }
  return 23; // Aula de Informática
};
