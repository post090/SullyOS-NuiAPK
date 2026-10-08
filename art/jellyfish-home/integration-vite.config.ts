import {mergeConfig} from 'vite';
import config from '../../vite.config';
export default mergeConfig(config,{optimizeDeps:{entries:['test/fixtures/home3d.html']}});
