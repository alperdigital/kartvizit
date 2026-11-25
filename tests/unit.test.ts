import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { cards, combine, duplicates, fold, matches, newCard, normalizePhone, safeUrl } from '../src/services/cards'
import { backup, csv, formulaSafe, makeFile, readBackup, restore, vcard } from '../src/services/export'
import { claudeExport, parseClaudeTransfer, importClaudeTransfer } from '../src/services/claude-transfer'
import { BusinessCardParser } from '../src/services/parser'

const parse=(text:string)=>new BusinessCardParser().parse({text,confidence:96,lines:[]})
describe('Kartvizit ayrıştırma ve arama',()=>{
  it('Türkçe karakterleri normalize eder',()=>{
    expect(fold('Şahin ÇAĞRI Işık Öztürk İpek Ünal')).toBe('sahin cagri isik ozturk ipek unal')
  })
  it('Türkiye ve uluslararası telefonları sınıflandırıp normalize eder',()=>{
    expect(normalizePhone('0532 000 00 00')).toBe('+905320000000')
    expect(normalizePhone('0044 20 7946 0958')).toBe('+442079460958')
    expect(parse('GSM: 0532 000 00 00\nOffice: +1 (202) 555-0142\nFaks: +90 212 000 00 00').phoneNumbers).toEqual([
      {number:'+905320000000',kind:'mobile'},{number:'+12025550142',kind:'work'},{number:'+902120000000',kind:'fax'},
    ])
  })
  it('e-posta alan adını web sitesi olarak tekrarlamaz',()=>{
    const result=parse('hello@example.test\nhttps://example.com\nlinkedin.com/in/sample')
    expect(result.emailAddresses).toEqual(['hello@example.test'])
    expect(result.websites).toEqual(['https://example.com'])
    expect(result.socialLinks).toEqual(['linkedin.com/in/sample'])
  })
  it('Türkçe ve İngilizce alanları tespit eder ve tahminleri işaretler',()=>{
    const tur=parse('Örnek Şahin\nDeneme Teknoloji A.Ş.\nGenel Müdür\nDepartman: Ürün\nAdres: Deneme Mah. 12\nŞehir: İstanbul\nÜlke: Türkiye\nPosta kodu: 34000')
    expect(tur).toMatchObject({firstName:'Örnek',lastName:'Şahin',company:'Deneme Teknoloji A.Ş.',jobTitle:'Genel Müdür',department:'Ürün',needsReview:true})
    expect(tur.addresses[0]).toEqual({street:'Deneme Mah. 12',city:'İstanbul',country:'Türkiye',postalCode:'34000'})
    expect(parse('Sample Contact\nExample Studio\nFounder').jobTitle).toBe('Founder')
    expect(parse('office@example.test').fullName).toBe('')
  })
  it('mükerrer kayıtları üç kuralla bulur ve birleştirir',()=>{
    const original={...newCard(),fullName:'Örnek Şahin',company:'Örnek Şirket',emailAddresses:['hello@example.test'],phoneNumbers:[{number:'0532 000 00 00',kind:'mobile'} as const],notes:'Önceki not'}
    expect(duplicates({...newCard(),emailAddresses:['HELLO@example.test']},[original])).toEqual([original])
    expect(duplicates({...newCard(),phoneNumbers:[{kind:'work',number:'+90 532 0000000'}]},[original])).toEqual([original])
    expect(duplicates({...newCard(),fullName:'Ornek Sahi',company:'ornek sirket'},[original])).toEqual([original])
    expect(combine(original,{...newCard(),notes:'Yeni not'},true)).toMatchObject({id:original.id,notes:'Önceki not\nYeni not',emailAddresses:['hello@example.test']})
  })
  it('binlerce kartvizitte farklı alanları arar',()=>{
    const data=Array.from({length:5000},(_,i)=>({...newCard(),company:'Örnek Grup '+i,notes:'Ürün'}))
    data[4901].fullName='Çağrı Işık'
    expect(data.filter(c=>matches(c,'cagri isik urun 4901'))).toEqual([data[4901]])
  })
})
describe('Dosyalar ve kalıcılık',()=>{
  const record={...newCard(),fullName:'Örnek Şahin',company:'Çağrı',notes:'=SUM(1,2)'}
  it('BOM içeren CSV üretir ve formülleri etkisizleştirir',()=>{
    expect(csv([record])).toMatch(/^\uFEFF/)
    expect(csv([record])).toContain('"\'=SUM(1,2)"')
    expect(formulaSafe('  @evil')).toBe("'  @evil")
  })
  it('vCard metninde yeni satırları ve ayırıcıları kaçırır',()=>{
    const output=vcard([{...record,notes:'a,b\r\nTEL:123'}])
    expect(output).toContain('FN:Örnek Şahin\r\n')
    expect(output).toContain('NOTE:a\\,b\\nTEL:123')
  })
  it('gerçek XLSX dosyası üretir',async()=>{
    const file=await makeFile([record],'xlsx')
    expect(file.name).toMatch(/\.xlsx$/)
    expect([...new Uint8Array(await file.arrayBuffer()).slice(0,4)]).toEqual([80,75,3,4])
  })
  it('JSON verisini doğrular ve mevcut kayıtlar üzerine yazmaz',async()=>{
    expect(readBackup(backup([record]))).toEqual([record])
    expect(()=>readBackup(backup([record,record]))).toThrow()
    expect(()=>readBackup('{"format":"kartvizit","version":1,"cards":[{"id":"x"}]}')).toThrow()
    await cards.put(record)
    const added={...newCard(),fullName:'Yedek Kayıt'}
    const file=new File([backup([{...record,notes:'üzerine yazma'},added])],'backup.json')
    expect(await restore(file)).toEqual({added:1,skipped:1})
    expect(await cards.get(record.id)).toEqual(record)
    expect(await cards.get(added.id)).toEqual(added)
    await cards.bulkDelete([record.id,added.id])
  })
  it('IndexedDB oluşturma, düzenleme, yıldızlama, yeniden açma ve silmeyi destekler',async()=>{
    await cards.add(record)
    await cards.update(record.id,{isFavorite:true,tags:['Test']})
    cards.db.close()
    await cards.db.open()
    expect(await cards.get(record.id)).toMatchObject({isFavorite:true,tags:['Test']})
    await cards.delete(record.id)
    expect(await cards.get(record.id)).toBeUndefined()
  })
  it('zararlı protokolleri ve kimlik içeren URL’leri reddeder',()=>{
    for(const value of ['javascript:alert(1)','data:text/html,n','file:///etc/passwd','https://a@b.example','//example.com']) expect(safeUrl(value)).toBeUndefined()
    expect(safeUrl('example.com')).toBe('https://example.com/')
  })
})


describe('Claude Artifact aktarımı',()=>{
  it('fotoğrafları ve ham OCR verisini çıkarır, kimliği korur',()=>{
    const card={...newCard('scan'),fullName:'Örnek Kişi',rawOcrText:'private OCR',ocrConfidence:92,photos:['data:image/jpeg;base64,YQ==']}
    const result=parseClaudeTransfer(claudeExport([card]))[0]
    expect(result).toMatchObject({id:card.id,fullName:card.fullName,rawOcrText:'',ocrConfidence:null,fieldConfidence:{}})
    expect(result.photos).toBeUndefined()
    expect(()=>parseClaudeTransfer('{"format":"kartvizit","version":1,"cards":[{}]}')).toThrow()
    expect(()=>parseClaudeTransfer(claudeExport([card,card]))).toThrow()
  })
  it('yalnızca yeni kayıtları ve yeni sürümleri alır, benzer kartları korur',async()=>{
    const original={...newCard(),fullName:'Örnek Kişi',emailAddresses:['claude-transfer@example.test'],rawOcrText:'local',createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z'}
    try{
      expect(await importClaudeTransfer([original])).toMatchObject({added:1})
      await cards.update(original.id,{rawOcrText:'local OCR'})
      const newer={...original,company:'Yeni şirket',updatedAt:'2026-01-02T00:00:00.000Z'}
      expect(await importClaudeTransfer([newer])).toMatchObject({updated:1})
      expect(await cards.get(original.id)).toMatchObject({company:'Yeni şirket',rawOcrText:'local OCR'})
      expect(await importClaudeTransfer([newer])).toMatchObject({skipped:1})
      expect(await importClaudeTransfer([{...newer,company:'Çakışan'}])).toMatchObject({conflicts:1})
      expect(await importClaudeTransfer([{...newer,id:crypto.randomUUID()}])).toMatchObject({conflicts:1})
    }finally{await cards.delete(original.id)}
  })
})
