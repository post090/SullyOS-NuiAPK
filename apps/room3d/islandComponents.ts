// Public ESM subpaths avoid 2.1.0's broken Node-side Drawer dependency.
// Root imports below are type-only; runtime loads only the components we use.
import {Button as IslandButton} from 'animal-island-ui/es/components/Button/Button.js';
import {Card as IslandCard} from 'animal-island-ui/es/components/Card/Card.js';
import {Title as IslandTitle} from 'animal-island-ui/es/components/Title/Title.js';
import {Switch as IslandSwitch} from 'animal-island-ui/es/components/Switch/Switch.js';
export const Button: typeof import('animal-island-ui').Button = IslandButton;
export const Card: typeof import('animal-island-ui').Card = IslandCard;
export const Title: typeof import('animal-island-ui').Title = IslandTitle;
export const Switch: typeof import('animal-island-ui').Switch = IslandSwitch;
