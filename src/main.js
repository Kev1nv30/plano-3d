(function () {
  window.addEventListener("DOMContentLoaded", () => {
    const app = new window.Plano3D.AppController();
    app.init();
    window.plano3dApp = app;
  });
}());
