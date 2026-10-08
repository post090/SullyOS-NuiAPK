import {createHome,findPlace} from '../../apps/room3d/model.js';
export function bedroomHome(catalog,bed='bedroom_single_bed'){
 const home=createHome(catalog),r=home.rooms[0];r.name='奶油卧室';r.items=[];
 for(const [assetId,x,z]of [[bed,0,-1],['bedroom_wardrobe',-3.4,-2.4],['bedroom_vanity',-3,1.45],['bedroom_stool',-3,2.8],['bedroom_dresser',3,1],['bedroom_nightstand',3,-2.6],['bedroom_floor_lamp',3,-.95],['bedroom_bench',.2,2.65],['bedroom_jelly',2.9,2.85]])r.items.push({id:assetId,assetId,x,y:.15,z,rotation:0,color:null,stored:false});
 for(const [id,parent]of [['bedroom_table_lamp','bedroom_nightstand'],['bedroom_alarm','bedroom_nightstand'],['bedroom_mirror','bedroom_dresser'],['bedroom_jewelry_box','bedroom_dresser'],['bedroom_brushes','bedroom_vanity'],['bedroom_perfume','bedroom_vanity']]){const subset={...r,items:r.items.filter(i=>i.id===parent||i.supportId===parent)};r.items.push(findPlace(catalog.find(a=>a.id===id),subset,catalog,id));}
 return home;
}
