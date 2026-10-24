

export interface ContourPoint { x: number; y: number }

export interface ContourPath { points: ContourPoint[]; closed: boolean }

export interface Contour { elevation: number; paths: ContourPath[] }
