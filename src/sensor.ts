import type { PromisifiedBus } from 'i2c-bus';

class Sensor {

  constructor(readonly bus: PromisifiedBus, readonly address: number) {
  }

  sendCommand(command: number) {
    const buffer = Buffer.alloc(1);
    buffer.writeUInt8(command);
    return this.bus.i2cWrite(this.address, buffer.length, buffer);
  }

  readData(n: number): Promise<number[]> {
    const buffer = Buffer.allocUnsafe(n * 3);
    return this.bus.i2cRead(this.address, buffer.length, buffer)
      .then(({buffer}) => {
        const data = [];
        for (let offset = 0; offset < buffer.length; offset += 3) {
          const crc = buffer.readUInt8(offset + 2);
          if (Sensor.checksum(buffer.slice(offset, offset + 2)) !== crc) {
            throw new Error("CRC Error");
          }
          data.push(buffer.readUInt16BE(offset));
        }
        return data;
      });
  }

  static checksum(data: Buffer): number {
    let crc = 0x00;
    for (const byte of data) {
      crc ^= byte;
      for (let i = 0; i < 8; i++) {
        crc = crc & 0x80 ? (crc << 1) ^ 0x31 : crc << 1;
      }
    }
    return crc & 0xff;
  }

  static wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Humidity and temperature sensor
 */

export class HumidityTemperatureSensor extends Sensor {
  constructor(bus: PromisifiedBus, address = 0x40) {
    super(bus, address);
  }

  conversion(): Promise<void> {
    return this.sendCommand(0x40)// | 0b11 << 3 | 0b11 << 1) // OSR=3
      .then(() => Sensor.wait(1+1.6+3))//(7.8 + 12.1 + 3));
  }

  readTRH(): Promise<HumidityTemperatureData> {
    return this.sendCommand(0x00)
      .then(() => this.readData(2))
      .then(([temperature, humidity]) => ({
        humidity: humidity * 100 / 0xffff,
        temperature: temperature * 165 / 0xffff - 40,
      }))
  }

  measure(): Promise<HumidityTemperatureData> {
    return this.conversion()
      .then(() => this.readTRH());
  }

  reset(): Promise<void> {
    return this.sendCommand(0x1e)
      .then(() => Sensor.wait(5)); // The reset takes less than 5ms.
  }
}

export interface HumidityTemperatureData { humidity: number; temperature: number }
