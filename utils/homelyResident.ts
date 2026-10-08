export function resolveHomelyResident<T extends {id:string}>(characters:T[], activeId?:string|null, lockedId?:string):T|undefined {
  return characters.find(c=>c.id===lockedId) ?? characters.find(c=>c.id===activeId) ?? characters[0];
}
