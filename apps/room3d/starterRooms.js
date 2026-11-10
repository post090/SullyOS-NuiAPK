// IDs are scoped to one home. Schedules can refer to them before the layout is furnished.
// Integer navigation cells; homeDisplayX centers the 3/2/1 floors in map and overview.
export const STARTER_ROOMS = [
    {id: 'starter-living', name: '客厅', x: 0, level: 0, kind: 'living'},
    {id: 'starter-bathroom', name: '卫生间', x: 1, level: 0, kind: 'bathroom'},
    {id: 'starter-kitchen', name: '厨房', x: 2, level: 0, kind: 'kitchen'},
    {id: 'starter-bedroom', name: '卧室', x: 1, level: 1, kind: 'bedroom'},
    {id: 'starter-study', name: '书房', x: 2, level: 1, kind: 'study'},
    {id: 'starter-spare', name: '空房', x: 2, level: 2, kind: null},
];
