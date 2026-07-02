export default {
  async fetch(request, env) {
    // env 里自动携带 KV/R2 绑定，和Pages环境一致
    return env.ASSETS.fetch(request);
  }
};