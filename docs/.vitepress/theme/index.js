import DefaultTheme from 'vitepress/theme';
import ScriptBlock from './components/ScriptBlock.vue';
import './custom.css';

export default {
  ...DefaultTheme,
  enhanceApp({ app }) {
    app.component('ScriptBlock', ScriptBlock);
  }
};
