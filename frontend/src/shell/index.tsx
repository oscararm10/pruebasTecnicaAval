/**
 * Entry asíncrono requerido por Module Federation:
 * los shared (react, react-dom, react-router-dom) no pueden consumirse
 * de forma eager desde el entry síncrono.
 */
import('./bootstrap');
