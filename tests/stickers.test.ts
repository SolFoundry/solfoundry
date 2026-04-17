import { expect } from 'chai';

const stickers = [
  require('../assets/stickers/solfoundry_sticker_1.png'),
  require('../assets/stickers/solfoundry_sticker_2.png'),
  require('../assets/stickers/solfoundry_sticker_3.png'),
  require('../assets/stickers/solfoundry_sticker_4.png'),
  require('../assets/stickers/solfoundry_sticker_5.png'),
  require('../assets/stickers/solfoundry_sticker_6.png'),
  require('../assets/stickers/solfoundry_sticker_7.png'),
  require('../assets/stickers/solfoundry_sticker_8.png'),
  require('../assets/stickers/solfoundry_sticker_9.png'),
  require('../assets/stickers/solfoundry_sticker_10.png')
];

describe('Sticker Tests', () => {
  it('should have 10 stickers', () => {
    expect(stickers.length).to.equal(10);
  });

  stickers.forEach((sticker, index) => {
    it(`should be a valid PNG for sticker ${index + 1}`, () => {
      expect(sticker.type).to.equal('image/png');
    });
  });
});