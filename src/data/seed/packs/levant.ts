import type { SeedPack } from '../types'

/** Arabic-only culture words — deliberately no English, to exercise flexible pairs (spec §5.1). */
export const levant: SeedPack = {
  id: 'levant',
  name: { ar: 'من عنّا' },
  rows: [
    ['manaeesh', null, 'مناقيش', null, 'زعتر'],
    ['kibbeh', null, 'كبّة', null, 'برغل'],
    ['tabbouleh', null, 'تبّولة', null, 'بقدونس'],
    ['fattoush', null, 'فتّوش', null, 'خبز مقمّر'],
    ['mjaddara', null, 'مجدّرة', null, 'عدس'],
    ['maamoul', null, 'معمول', null, 'عيد'],
    ['knafeh', null, 'كنافة', null, 'جبنة'],
    ['dabke', null, 'دبكة', null, 'عرس'],
    ['argileh', null, 'أركيلة', null, 'فحم'],
    ['tarboush', null, 'طربوش', null, 'راس'],
    ['oud', null, 'عود', null, 'أوتار'],
    ['darbuka', null, 'دربكة', null, 'إيقاع'],
    ['labneh', null, 'لبنة', null, 'زيت زيتون'],
    ['arabic-coffee', null, 'قهوة عربية', null, 'دلّة'],
    ['sahlab', null, 'سحلب', null, 'قرفة'],
    ['kaak', null, 'كعك', null, 'سمسم'],
    ['mouneh', null, 'مونة', null, 'مرطبانات'],
    ['hakawati', null, 'حكواتي', null, 'قصص'],
    ['souk', null, 'سوق', null, 'بسطة'],
    ['foul', null, 'فول مدمّس', null, 'كمّون'],
    ['mahshi', null, 'محشي', null, 'كوسا'],
    ['zajal', null, 'زجل', null, 'شعر'],
    ['zalghouta', null, 'زلغوطة', null, 'فرح'],
    ['pomegranate-molasses', null, 'دبس رمان', null, 'حامض'],
    ['fairuz', null, 'فيروز', null, 'الصبح'],
  ],
}
