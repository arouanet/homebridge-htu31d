import type { API } from 'homebridge';
import { HumidityTemperatureAccessory } from './accessory';

export = (api: API): void => {
  api.registerAccessory("HTU31D", HumidityTemperatureAccessory);
};
