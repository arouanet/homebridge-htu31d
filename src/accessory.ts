import type {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  CharacteristicGetCallback,
  Logging,
  Service,
} from 'homebridge';

import { openPromisified } from 'i2c-bus';

import type { HumidityTemperatureData } from './sensor';
import { HumidityTemperatureSensor } from './sensor';

interface PluginConfig extends AccessoryConfig {
  bus?: number;
}

export class HumidityTemperatureAccessory implements AccessoryPlugin {

  private readonly informationService: Service;
  private readonly temperatureService: Service;
  private readonly humidityService: Service;

  private sensor: HumidityTemperatureSensor | undefined;
  private data: HumidityTemperatureData = {humidity: 0, temperature: 0};

  constructor(readonly log: Logging, config: PluginConfig, api: API) {
    openPromisified(config.bus ?? 1)
      .then(bus => {
        this.sensor = new HumidityTemperatureSensor(bus);
        this.sensor.reset()
          .then(() => {
            setInterval(this.measure.bind(this), 1000);
          })
          .catch(error => { bus.close(); throw error; });
      })
      .catch(error => log.error(error.message));

    this.temperatureService = new api.hap.Service.TemperatureSensor();

    this.temperatureService.getCharacteristic(api.hap.Characteristic.CurrentTemperature)
      .setProps({minValue: -40, maxValue: 125})
      .on(api.hap.CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        callback(undefined, this.data.temperature);
      });

    this.humidityService = new api.hap.Service.HumiditySensor();

    this.humidityService.getCharacteristic(api.hap.Characteristic.CurrentRelativeHumidity)
      .on(api.hap.CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        callback(undefined, this.data.humidity);
      });

    this.informationService = new api.hap.Service.AccessoryInformation()
      .setCharacteristic(api.hap.Characteristic.Manufacturer, "TE")
      .setCharacteristic(api.hap.Characteristic.Model, "HTU31D");
  }

  measure(): void {
    this.sensor?.measure()
      .then(data => {
        this.data = data;
        this.log.debug(`Humidity: ${data.humidity.toFixed(2)} %, Temperature: ${data.temperature.toFixed(2)} °C`)
      })
      .catch(error => this.log.warn(error.message));
  }

  getServices(): Service[] {
    return [
      this.informationService,
      this.temperatureService,
      this.humidityService,
    ];
  }
}
