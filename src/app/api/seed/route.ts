/**
 * 知识库种子数据 API
 * 初始化时自动导入基础医疗知识
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { createHash } from 'crypto';

function md5(content: string): string {
  return createHash('md5').update(content).digest('hex');
}

const medicalKnowledge = [
  {
    title: '头痛',
    content: '头痛是临床常见的症状，通常将局限于头颅上半部，包括眉弓、耳轮上缘和枕外隆突连线以上部位的疼痛统称头痛。',
    category: '症状',
    summary: '头痛是临床常见的症状，可由多种原因引起。',
    symptoms: '头痛的表现形式多样，可为搏动性疼痛、压迫性疼痛、刺痛等。可伴随恶心、呕吐、畏光、畏声等症状。',
    etiology: '头痛的病因复杂，可分为原发性和继发性。原发性头痛包括偏头痛、紧张型头痛、三叉神经自主神经性头痛等；继发性头痛可由感染、外伤、血管疾病等引起。',
    diagnosis: '头痛的诊断需要详细询问病史，了解头痛的部位、性质、持续时间、伴随症状等。必要时进行头颅CT、MRI等检查。',
    treatment: '头痛的治疗需根据病因进行针对性治疗。偏头痛急性发作可使用曲普坦类药物；紧张型头痛可使用非甾体抗炎药；同时注意休息、避免诱因。',
    prevention: '保持规律作息、适度运动、避免过度疲劳和精神紧张，可减少头痛发作。',
  },
  {
    title: '感冒',
    content: '感冒是一种常见的急性上呼吸道病毒性感染性疾病，多呈自限性。',
    category: '疾病',
    summary: '感冒是最常见的呼吸道感染，通常由病毒引起，症状较轻，一周左右可自愈。',
    symptoms: '主要表现为鼻塞、流涕、咽痛、咳嗽、低热、头痛、全身不适等。',
    etiology: '感冒主要由鼻病毒、冠状病毒、腺病毒等引起，通过飞沫传播或接触传播。',
    diagnosis: '根据症状和体征即可诊断，一般不需要特殊检查。血常规检查可帮助判断是否合并细菌感染。',
    treatment: '以对症治疗为主，包括休息、多饮水、使用解热镇痛药（如对乙酰氨基酚、布洛芬）缓解发热和疼痛，使用减充血剂缓解鼻塞。',
    prevention: '勤洗手、避免接触感冒患者、保持室内通风、增强体质可预防感冒。',
  },
  {
    title: '发烧',
    content: '发烧即发热，是指致热原直接作用于体温调节中枢、体温中枢功能紊乱或各种原因引起的产热过多、散热减少，导致体温升高超过正常范围。',
    category: '症状',
    summary: '发热是人体对致病因子的一种防御反应，正常体温范围为36.1-37.2℃。',
    symptoms: '体温升高，可伴有寒战、出汗、头痛、肌肉酸痛、食欲下降等。',
    etiology: '发热的原因可分为感染性和非感染性。感染性发热由细菌、病毒、真菌等引起；非感染性发热可由肿瘤、免疫性疾病、中暑等引起。',
    diagnosis: '体温测量是最基本的诊断方法。需结合血常规、CRP、血培养等检查明确病因。',
    treatment: '低热可暂不处理，体温超过38.5℃可使用退热药（对乙酰氨基酚、布洛芬）。同时针对病因治疗，注意补液和休息。',
    prevention: '增强体质、避免感染、及时治疗基础疾病可减少发热发生。',
  },
  {
    title: '咳嗽',
    content: '咳嗽是呼吸道受到刺激时引起的一种防御性反射动作，有利于清除呼吸道分泌物和异物。',
    category: '症状',
    summary: '咳嗽是常见的呼吸道症状，可分为干咳和湿咳，急性咳嗽和慢性咳嗽。',
    symptoms: '咳嗽可伴有咳痰、胸闷、气短等。干咳无痰或痰少，湿咳伴有较多痰液。',
    etiology: '急性咳嗽常见于感冒、急性支气管炎；慢性咳嗽（>8周）常见于咳嗽变异性哮喘、上气道咳嗽综合征、胃食管反流等。',
    diagnosis: '需详细询问病史、体格检查，必要时行胸部X线、肺功能、痰液检查等。',
    treatment: '针对病因治疗。干咳可使用镇咳药（右美沙芬），湿咳以祛痰为主（氨溴索、乙酰半胱氨酸）。',
    prevention: '避免吸烟和二手烟、注意室内空气质量、预防呼吸道感染。',
  },
  {
    title: '腹泻',
    content: '腹泻是指排便次数增多，粪便稀薄或呈水样，可伴有腹痛、里急后重等症状。',
    category: '症状',
    summary: '腹泻是消化系统常见症状，可分为急性腹泻和慢性腹泻。',
    symptoms: '大便次数增多、粪质稀薄或水样便，可伴有腹痛、恶心、呕吐、发热等。',
    etiology: '急性腹泻多由感染（细菌、病毒、寄生虫）、食物中毒、药物引起；慢性腹泻可由炎症性肠病、肠易激综合征、吸收不良等引起。',
    diagnosis: '根据病史、体格检查、粪便常规和培养、肠镜等检查进行诊断。',
    treatment: '急性腹泻以补液、止泻为主，可使用蒙脱石散、口服补液盐；细菌感染可使用抗生素。慢性腹泻需针对病因治疗。',
    prevention: '注意饮食卫生、避免生冷食物、勤洗手。',
  },
  {
    title: '高血压',
    content: '高血压是一种以动脉血压持续升高为特征的慢性疾病，是心脑血管病最主要的危险因素。',
    category: '疾病',
    summary: '高血压定义为收缩压≥140mmHg和/或舒张压≥90mmHg，是最常见的心血管疾病。',
    symptoms: '早期多无症状，随着病情进展可出现头痛、头晕、耳鸣、心悸、胸闷等。',
    etiology: '原发性高血压病因不完全明确，与遗传、高盐饮食、肥胖、精神紧张、饮酒等有关。继发性高血压由肾脏疾病、内分泌疾病等引起。',
    diagnosis: '非同日三次测量血压，收缩压≥140mmHg和/或舒张压≥90mmHg可诊断。需排除继发性高血压。',
    treatment: '生活方式干预：低盐饮食、适量运动、控制体重、戒烟限酒。药物治疗：利尿剂、ACEI、ARB、CCB等。',
    prevention: '健康饮食、规律运动、控制体重、限制饮酒、定期监测血压。',
  },
  {
    title: '布洛芬',
    content: '布洛芬是一种非甾体抗炎药（NSAID），具有解热、镇痛、抗炎作用。',
    category: '药品',
    summary: '布洛芬是常用的解热镇痛药，适用于发热、头痛、关节痛、牙痛、痛经等症状。',
    symptoms: '',
    etiology: '',
    diagnosis: '',
    treatment: '口服：成人每次200-400mg，每4-6小时一次，24小时内不超过1200mg。儿童按体重计算剂量。',
    prevention: '注意事项：1.不宜空腹服用；2.有消化道溃疡者慎用；3.孕妇、哺乳期妇女禁用；4.可增加心血管事件风险；5.与其他NSAID不宜合用。',
  },
  {
    title: '阿莫西林',
    content: '阿莫西林是一种广谱半合成青霉素类抗生素，用于治疗敏感菌引起的各种感染。',
    category: '药品',
    summary: '阿莫西林是常用的抗生素，用于治疗细菌感染如呼吸道感染、泌尿系统感染、皮肤软组织感染等。',
    symptoms: '',
    etiology: '',
    diagnosis: '',
    treatment: '口服：成人每次0.5g，每6-8小时一次，一日剂量不超过4g。儿童按体重20-40mg/kg/日，分3次服用。',
    prevention: '注意事项：1.青霉素过敏者禁用；2.使用前需做皮试；3.不宜与抑菌药合用；4.长期使用需监测肝肾功能；5.不可用于病毒感染。',
  },
  {
    title: '心内科',
    content: '心内科（心血管内科）是研究心血管疾病病因、诊断、治疗和预防的内科专科。',
    category: '科室',
    summary: '心内科主要诊治高血压、冠心病、心律失常、心力衰竭、心肌病等心血管疾病。',
    symptoms: '',
    etiology: '',
    diagnosis: '心内科常见检查：心电图、动态心电图、心脏超声、冠脉造影、心肌酶谱、BNP等。',
    treatment: '',
    prevention: '',
  },
  {
    title: '体检报告解读',
    content: '体检报告是对身体健康状况的全面评估，正确解读体检指标对疾病早期发现和预防具有重要意义。',
    category: '体检',
    summary: '体检报告中的常见指标包括血常规、肝功能、肾功能、血脂、血糖等，需结合参考范围综合分析。',
    symptoms: '',
    etiology: '',
    diagnosis: '血常规：白细胞4-10×10⁹/L，红细胞男4.0-5.5×10¹²/L/女3.5-5.0×10¹²/L，血红蛋白男120-160g/L/女110-150g/L，血小板100-300×10⁹/L。肝功能：谷丙转氨酶0-40U/L，谷草转氨酶0-40U/L。肾功能：肌酐44-133μmol/L，尿素氮2.9-8.2mmol/L。血脂：总胆固醇<5.18mmol/L，甘油三酯<1.70mmol/L，低密度脂蛋白<3.37mmol/L。血糖：空腹3.9-6.1mmol/L。',
    treatment: '异常指标需结合临床症状和其他检查综合判断，必要时就医复查。',
    prevention: '',
  },
];

export async function POST(request: NextRequest) {
  try {
    const { domain } = await request.json();
    const targetDomain = domain || 'medical';
    
    let count = 0;
    let updated = 0;
    
    for (const item of medicalKnowledge) {
      const fingerprint = md5(`${item.title}_${item.content}`);
      
      try {
        // Step 1: Try upsert with exact fingerprint match
        // If same (domain, source, fingerprint) exists → no-op (unchanged)
        // If fingerprint doesn't match → falls through to update logic
        const existing = await db.knowledgeEntry.findFirst({
          where: {
            domain: targetDomain,
            source: 'seed',
            title: item.title,
          },
        });

        if (existing) {
          if (existing.fingerprint !== fingerprint) {
            // Content has changed — update the entry with new fingerprint
            await db.knowledgeEntry.update({
              where: { id: existing.id },
              data: {
                content: item.content,
                category: item.category,
                summary: item.summary || null,
                symptoms: item.symptoms || null,
                etiology: item.etiology || null,
                diagnosis: item.diagnosis || null,
                treatment: item.treatment || null,
                prevention: item.prevention || null,
                fingerprint,
              },
            });
            updated++;
            count++;
          }
          // If fingerprint matches → no change needed, skip
        } else {
          // No existing entry — create new
          await db.knowledgeEntry.create({
            data: {
              domain: targetDomain,
              source: 'seed',
              title: item.title,
              content: item.content,
              category: item.category,
              summary: item.summary || null,
              symptoms: item.symptoms || null,
              etiology: item.etiology || null,
              diagnosis: item.diagnosis || null,
              treatment: item.treatment || null,
              prevention: item.prevention || null,
              fingerprint,
            },
          });
          count++;
        }
      } catch (e) {
        // Skip duplicates or errors
        console.error('[Seed API] 处理条目失败:', item.title, e);
      }
    }
    
    return Response.json({
      success: true,
      domain: targetDomain,
      entries_added: count,
      entries_updated: updated,
      message: `已处理 ${count} 条知识到 ${targetDomain} 领域（其中 ${updated} 条内容已更新）`,
    });
  } catch (error) {
    console.error('[Seed API] 导入失败:', error);
    return Response.json({ error: '种子数据导入失败' }, { status: 500 });
  }
}
