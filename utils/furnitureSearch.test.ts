import {expect,it} from 'vitest';
import {furnitureSearch} from '../apps/room3d/furnitureSearch';
it('finds abbreviated names and multiple keywords without matching unrelated furniture',()=>{
 expect(furnitureSearch('双人布艺沙发 坐下休息','双沙')).toBe(true);
 expect(furnitureSearch('Coffee Table','ＣＯＦＦＥＥ')).toBe(true);
 expect(furnitureSearch('绿色餐椅 坐下','绿 坐')).toBe(true);
 expect(furnitureSearch('原木书柜','沙发')).toBe(false);
});
