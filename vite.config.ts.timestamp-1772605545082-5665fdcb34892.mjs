// vite.config.ts
import path from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
import vue from "file:///D:/vue3-track/node_modules/@vitejs/plugin-vue/dist/index.mjs";
import vueJsx from "file:///D:/vue3-track/node_modules/@vitejs/plugin-vue-jsx/dist/index.mjs";
import AutoImport from "file:///D:/vue3-track/node_modules/unplugin-auto-import/dist/vite.mjs";
import { VantResolver } from "file:///D:/vue3-track/node_modules/unplugin-vue-components/dist/resolvers.js";
import Components from "file:///D:/vue3-track/node_modules/unplugin-vue-components/dist/vite.js";
import { defineConfig, loadEnv } from "file:///D:/vue3-track/node_modules/vite/dist/node/index.js";
import viteCompression from "file:///D:/vue3-track/node_modules/vite-plugin-compression/dist/index.mjs";
import { createHtmlPlugin } from "file:///D:/vue3-track/node_modules/vite-plugin-html/dist/index.mjs";
import { mockDevServerPlugin } from "file:///D:/vue3-track/node_modules/vite-plugin-mock-dev-server/dist/index.js";
import { createSvgIconsPlugin } from "file:///D:/vue3-track/node_modules/vite-plugin-svg-icons/dist/index.mjs";

// build/cdn.ts
import { cdn } from "file:///D:/vue3-track/node_modules/vite-plugin-cdn2/dist/index.mjs";
import { unpkg } from "file:///D:/vue3-track/node_modules/vite-plugin-cdn2/dist/resolver/unpkg.mjs";
function enableCDN(isEnabled) {
  if (isEnabled === "true") {
    return cdn({
      resolve: unpkg(),
      modules: ["vue", "vue-demi", "pinia", "axios", "vant", "vue-router"]
    });
  }
}

// vite.config.ts
var __vite_injected_original_import_meta_url = "file:///D:/vue3-track/vite.config.ts";
var root = process.cwd();
var vite_config_default = defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, "");
  return {
    base: env.VITE_PUBLIC_PATH || "/",
    plugins: [
      vue(),
      vueJsx(),
      mockDevServerPlugin(),
      // 自动导入 Vue/Vue Router/Pinia API
      AutoImport({
        imports: ["vue", "vue-router", "pinia"],
        dts: "src/typings/auto-imports.d.ts"
      }),
      // vant 组件自动按需引入
      Components({
        dts: "src/typings/components.d.ts",
        resolvers: [VantResolver()]
      }),
      // svg icon
      createSvgIconsPlugin({
        // 指定图标文件夹
        iconDirs: [path.resolve(root, "src/icons/svg")],
        // 指定 symbolId 格式
        symbolId: "icon-[dir]-[name]"
      }),
      // 生产环境 gzip 压缩资源
      viteCompression(),
      // 注入模板数据
      createHtmlPlugin({
        inject: {
          data: {
            ENABLE_ERUDA: env.VITE_ENABLE_ERUDA || "false"
          }
        }
      }),
      // 生产环境默认不启用 CDN 加速
      enableCDN(env.VITE_CDN_DEPS)
    ],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", __vite_injected_original_import_meta_url))
      }
    },
    server: {
      host: true,
      // 仅在 proxy 中配置的代理前缀， mock-dev-server 才会拦截并 mock
      // doc: https://github.com/pengzhanbo/vite-plugin-mock-dev-server
      proxy: {
        "^/dev-api": {
          target: ""
        }
      }
    },
    build: {
      rollupOptions: {
        output: {
          chunkFileNames: "static/js/[name]-[hash].js",
          entryFileNames: "static/js/[name]-[hash].js",
          assetFileNames: "static/[ext]/[name]-[hash].[ext]"
        }
      }
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAiYnVpbGQvY2RuLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiRDpcXFxcdnVlMy10cmFja1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiRDpcXFxcdnVlMy10cmFja1xcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRDovdnVlMy10cmFjay92aXRlLmNvbmZpZy50c1wiO2ltcG9ydCBwYXRoIGZyb20gJ25vZGU6cGF0aCdcbmltcG9ydCBwcm9jZXNzIGZyb20gJ25vZGU6cHJvY2VzcydcbmltcG9ydCB7IGZpbGVVUkxUb1BhdGgsIFVSTCB9IGZyb20gJ25vZGU6dXJsJ1xuaW1wb3J0IHZ1ZSBmcm9tICdAdml0ZWpzL3BsdWdpbi12dWUnXG5pbXBvcnQgdnVlSnN4IGZyb20gJ0B2aXRlanMvcGx1Z2luLXZ1ZS1qc3gnXG5pbXBvcnQgQXV0b0ltcG9ydCBmcm9tICd1bnBsdWdpbi1hdXRvLWltcG9ydC92aXRlJ1xuaW1wb3J0IHsgVmFudFJlc29sdmVyIH0gZnJvbSAndW5wbHVnaW4tdnVlLWNvbXBvbmVudHMvcmVzb2x2ZXJzJ1xuaW1wb3J0IENvbXBvbmVudHMgZnJvbSAndW5wbHVnaW4tdnVlLWNvbXBvbmVudHMvdml0ZSdcbmltcG9ydCB7IGRlZmluZUNvbmZpZywgbG9hZEVudiB9IGZyb20gJ3ZpdGUnXG5pbXBvcnQgdml0ZUNvbXByZXNzaW9uIGZyb20gJ3ZpdGUtcGx1Z2luLWNvbXByZXNzaW9uJ1xuaW1wb3J0IHsgY3JlYXRlSHRtbFBsdWdpbiB9IGZyb20gJ3ZpdGUtcGx1Z2luLWh0bWwnXG5pbXBvcnQgeyBtb2NrRGV2U2VydmVyUGx1Z2luIH0gZnJvbSAndml0ZS1wbHVnaW4tbW9jay1kZXYtc2VydmVyJ1xuaW1wb3J0IHsgY3JlYXRlU3ZnSWNvbnNQbHVnaW4gfSBmcm9tICd2aXRlLXBsdWdpbi1zdmctaWNvbnMnXG5pbXBvcnQgeyBlbmFibGVDRE4gfSBmcm9tICcuL2J1aWxkL2NkbidcblxuLy8gXHU1RjUzXHU1MjREXHU1REU1XHU0RjVDXHU3NkVFXHU1RjU1XHU4REVGXHU1Rjg0XG5jb25zdCByb290OiBzdHJpbmcgPSBwcm9jZXNzLmN3ZCgpXG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSB9KSA9PiB7XG4gIC8vIFx1NzNBRlx1NTg4M1x1NTNEOFx1OTFDRlxuICBjb25zdCBlbnYgPSBsb2FkRW52KG1vZGUsIHJvb3QsICcnKVxuICByZXR1cm4ge1xuICAgIGJhc2U6IGVudi5WSVRFX1BVQkxJQ19QQVRIIHx8ICcvJyxcbiAgICBwbHVnaW5zOiBbXG4gICAgICB2dWUoKSxcbiAgICAgIHZ1ZUpzeCgpLFxuICAgICAgbW9ja0RldlNlcnZlclBsdWdpbigpLFxuICAgICAgLy8gXHU4MUVBXHU1MkE4XHU1QkZDXHU1MTY1IFZ1ZS9WdWUgUm91dGVyL1BpbmlhIEFQSVxuICAgICAgQXV0b0ltcG9ydCh7XG4gICAgICAgIGltcG9ydHM6IFsndnVlJywgJ3Z1ZS1yb3V0ZXInLCAncGluaWEnXSxcbiAgICAgICAgZHRzOiAnc3JjL3R5cGluZ3MvYXV0by1pbXBvcnRzLmQudHMnLFxuICAgICAgfSksXG4gICAgICAvLyB2YW50IFx1N0VDNFx1NEVGNlx1ODFFQVx1NTJBOFx1NjMwOVx1OTcwMFx1NUYxNVx1NTE2NVxuICAgICAgQ29tcG9uZW50cyh7XG4gICAgICAgIGR0czogJ3NyYy90eXBpbmdzL2NvbXBvbmVudHMuZC50cycsXG4gICAgICAgIHJlc29sdmVyczogW1ZhbnRSZXNvbHZlcigpXSxcbiAgICAgIH0pLFxuICAgICAgLy8gc3ZnIGljb25cbiAgICAgIGNyZWF0ZVN2Z0ljb25zUGx1Z2luKHtcbiAgICAgICAgLy8gXHU2MzA3XHU1QjlBXHU1NkZFXHU2ODA3XHU2NTg3XHU0RUY2XHU1OTM5XG4gICAgICAgIGljb25EaXJzOiBbcGF0aC5yZXNvbHZlKHJvb3QsICdzcmMvaWNvbnMvc3ZnJyldLFxuICAgICAgICAvLyBcdTYzMDdcdTVCOUEgc3ltYm9sSWQgXHU2ODNDXHU1RjBGXG4gICAgICAgIHN5bWJvbElkOiAnaWNvbi1bZGlyXS1bbmFtZV0nLFxuICAgICAgfSksXG4gICAgICAvLyBcdTc1MUZcdTRFQTdcdTczQUZcdTU4ODMgZ3ppcCBcdTUzOEJcdTdGMjlcdThENDRcdTZFOTBcbiAgICAgIHZpdGVDb21wcmVzc2lvbigpLFxuICAgICAgLy8gXHU2Q0U4XHU1MTY1XHU2QTIxXHU2NzdGXHU2NTcwXHU2MzZFXG4gICAgICBjcmVhdGVIdG1sUGx1Z2luKHtcbiAgICAgICAgaW5qZWN0OiB7XG4gICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgRU5BQkxFX0VSVURBOiBlbnYuVklURV9FTkFCTEVfRVJVREEgfHwgJ2ZhbHNlJyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSksXG4gICAgICAvLyBcdTc1MUZcdTRFQTdcdTczQUZcdTU4ODNcdTlFRDhcdThCQTRcdTRFMERcdTU0MkZcdTc1MjggQ0ROIFx1NTJBMFx1OTAxRlxuICAgICAgZW5hYmxlQ0ROKGVudi5WSVRFX0NETl9ERVBTKSxcbiAgICBdLFxuICAgIHJlc29sdmU6IHtcbiAgICAgIGFsaWFzOiB7XG4gICAgICAgICdAJzogZmlsZVVSTFRvUGF0aChuZXcgVVJMKCcuL3NyYycsIGltcG9ydC5tZXRhLnVybCkpLFxuICAgICAgfSxcbiAgICB9LFxuICAgIHNlcnZlcjoge1xuICAgICAgaG9zdDogdHJ1ZSxcbiAgICAgIC8vIFx1NEVDNVx1NTcyOCBwcm94eSBcdTRFMkRcdTkxNERcdTdGNkVcdTc2ODRcdTRFRTNcdTc0MDZcdTUyNERcdTdGMDBcdUZGMEMgbW9jay1kZXYtc2VydmVyIFx1NjI0RFx1NEYxQVx1NjJFNlx1NjIyQVx1NUU3NiBtb2NrXG4gICAgICAvLyBkb2M6IGh0dHBzOi8vZ2l0aHViLmNvbS9wZW5nemhhbmJvL3ZpdGUtcGx1Z2luLW1vY2stZGV2LXNlcnZlclxuICAgICAgcHJveHk6IHtcbiAgICAgICAgJ14vZGV2LWFwaSc6IHtcbiAgICAgICAgICB0YXJnZXQ6ICcnLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICAgIGJ1aWxkOiB7XG4gICAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICAgIG91dHB1dDoge1xuICAgICAgICAgIGNodW5rRmlsZU5hbWVzOiAnc3RhdGljL2pzL1tuYW1lXS1baGFzaF0uanMnLFxuICAgICAgICAgIGVudHJ5RmlsZU5hbWVzOiAnc3RhdGljL2pzL1tuYW1lXS1baGFzaF0uanMnLFxuICAgICAgICAgIGFzc2V0RmlsZU5hbWVzOiAnc3RhdGljL1tleHRdL1tuYW1lXS1baGFzaF0uW2V4dF0nLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICB9XG59KVxuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFx2dWUzLXRyYWNrXFxcXGJ1aWxkXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJEOlxcXFx2dWUzLXRyYWNrXFxcXGJ1aWxkXFxcXGNkbi50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRDovdnVlMy10cmFjay9idWlsZC9jZG4udHNcIjtpbXBvcnQgeyBjZG4gfSBmcm9tICd2aXRlLXBsdWdpbi1jZG4yJ1xuaW1wb3J0IHsgdW5wa2cgfSBmcm9tICd2aXRlLXBsdWdpbi1jZG4yL3Jlc29sdmVyL3VucGtnJ1xuXG5leHBvcnQgZnVuY3Rpb24gZW5hYmxlQ0ROKGlzRW5hYmxlZDogc3RyaW5nKSB7XG4gIGlmIChpc0VuYWJsZWQgPT09ICd0cnVlJykge1xuICAgIHJldHVybiBjZG4oe1xuICAgICAgcmVzb2x2ZTogdW5wa2coKSxcbiAgICAgIG1vZHVsZXM6IFsndnVlJywgJ3Z1ZS1kZW1pJywgJ3BpbmlhJywgJ2F4aW9zJywgJ3ZhbnQnLCAndnVlLXJvdXRlciddLFxuICAgIH0pXG4gIH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBNk4sT0FBTyxVQUFVO0FBQzlPLE9BQU8sYUFBYTtBQUNwQixTQUFTLGVBQWUsV0FBVztBQUNuQyxPQUFPLFNBQVM7QUFDaEIsT0FBTyxZQUFZO0FBQ25CLE9BQU8sZ0JBQWdCO0FBQ3ZCLFNBQVMsb0JBQW9CO0FBQzdCLE9BQU8sZ0JBQWdCO0FBQ3ZCLFNBQVMsY0FBYyxlQUFlO0FBQ3RDLE9BQU8scUJBQXFCO0FBQzVCLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsNEJBQTRCOzs7QUNaNEwsU0FBUyxXQUFXO0FBQ3JQLFNBQVMsYUFBYTtBQUVmLFNBQVMsVUFBVSxXQUFtQjtBQUMzQyxNQUFJLGNBQWMsUUFBUTtBQUN4QixXQUFPLElBQUk7QUFBQSxNQUNULFNBQVMsTUFBTTtBQUFBLE1BQ2YsU0FBUyxDQUFDLE9BQU8sWUFBWSxTQUFTLFNBQVMsUUFBUSxZQUFZO0FBQUEsSUFDckUsQ0FBQztBQUFBLEVBQ0g7QUFDRjs7O0FEVnFJLElBQU0sMkNBQTJDO0FBZ0J0TCxJQUFNLE9BQWUsUUFBUSxJQUFJO0FBR2pDLElBQU8sc0JBQVEsYUFBYSxDQUFDLEVBQUUsS0FBSyxNQUFNO0FBRXhDLFFBQU0sTUFBTSxRQUFRLE1BQU0sTUFBTSxFQUFFO0FBQ2xDLFNBQU87QUFBQSxJQUNMLE1BQU0sSUFBSSxvQkFBb0I7QUFBQSxJQUM5QixTQUFTO0FBQUEsTUFDUCxJQUFJO0FBQUEsTUFDSixPQUFPO0FBQUEsTUFDUCxvQkFBb0I7QUFBQTtBQUFBLE1BRXBCLFdBQVc7QUFBQSxRQUNULFNBQVMsQ0FBQyxPQUFPLGNBQWMsT0FBTztBQUFBLFFBQ3RDLEtBQUs7QUFBQSxNQUNQLENBQUM7QUFBQTtBQUFBLE1BRUQsV0FBVztBQUFBLFFBQ1QsS0FBSztBQUFBLFFBQ0wsV0FBVyxDQUFDLGFBQWEsQ0FBQztBQUFBLE1BQzVCLENBQUM7QUFBQTtBQUFBLE1BRUQscUJBQXFCO0FBQUE7QUFBQSxRQUVuQixVQUFVLENBQUMsS0FBSyxRQUFRLE1BQU0sZUFBZSxDQUFDO0FBQUE7QUFBQSxRQUU5QyxVQUFVO0FBQUEsTUFDWixDQUFDO0FBQUE7QUFBQSxNQUVELGdCQUFnQjtBQUFBO0FBQUEsTUFFaEIsaUJBQWlCO0FBQUEsUUFDZixRQUFRO0FBQUEsVUFDTixNQUFNO0FBQUEsWUFDSixjQUFjLElBQUkscUJBQXFCO0FBQUEsVUFDekM7QUFBQSxRQUNGO0FBQUEsTUFDRixDQUFDO0FBQUE7QUFBQSxNQUVELFVBQVUsSUFBSSxhQUFhO0FBQUEsSUFDN0I7QUFBQSxJQUNBLFNBQVM7QUFBQSxNQUNQLE9BQU87QUFBQSxRQUNMLEtBQUssY0FBYyxJQUFJLElBQUksU0FBUyx3Q0FBZSxDQUFDO0FBQUEsTUFDdEQ7QUFBQSxJQUNGO0FBQUEsSUFDQSxRQUFRO0FBQUEsTUFDTixNQUFNO0FBQUE7QUFBQTtBQUFBLE1BR04sT0FBTztBQUFBLFFBQ0wsYUFBYTtBQUFBLFVBQ1gsUUFBUTtBQUFBLFFBQ1Y7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLElBQ0EsT0FBTztBQUFBLE1BQ0wsZUFBZTtBQUFBLFFBQ2IsUUFBUTtBQUFBLFVBQ04sZ0JBQWdCO0FBQUEsVUFDaEIsZ0JBQWdCO0FBQUEsVUFDaEIsZ0JBQWdCO0FBQUEsUUFDbEI7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
