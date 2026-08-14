/**
 * 省/市地名库：搜索关键字 + 坐标落点。
 * 省用 bbox；城市用中心点+半径。place-labels 城市可运行时并入。
 */

const PROVINCES = [
  { label: "北京", names: ["北京", "北京市", "beijing"], bbox: [115.4, 39.4, 117.5, 41.1] },
  { label: "天津", names: ["天津", "天津市", "tianjin"], bbox: [116.7, 38.55, 118.1, 40.25] },
  { label: "河北", names: ["河北", "河北省", "冀", "hebei"], bbox: [113.45, 36.05, 119.85, 42.62] },
  { label: "山西", names: ["山西", "山西省", "晋", "shanxi"], bbox: [110.23, 34.58, 114.55, 40.73] },
  { label: "内蒙古", names: ["内蒙古", "内蒙古自治区", "inner mongolia"], bbox: [97.17, 37.4, 126.07, 53.33] },
  { label: "辽宁", names: ["辽宁", "辽宁省", "辽", "liaoning"], bbox: [118.85, 38.72, 125.78, 43.43] },
  { label: "吉林", names: ["吉林", "吉林省", "jilin"], bbox: [121.63, 40.86, 131.32, 46.3] },
  { label: "黑龙江", names: ["黑龙江", "黑龙江省", "heilongjiang"], bbox: [121.18, 43.42, 135.09, 53.56] },
  { label: "上海", names: ["上海", "上海市", "shanghai"], bbox: [120.85, 30.67, 122.2, 31.88] },
  { label: "江苏", names: ["江苏", "江苏省", "苏", "jiangsu"], bbox: [116.36, 30.76, 121.95, 35.12] },
  { label: "浙江", names: ["浙江", "浙江省", "浙", "zhejiang"], bbox: [118.02, 27.14, 122.84, 31.18] },
  { label: "安徽", names: ["安徽", "安徽省", "皖", "anhui"], bbox: [114.88, 29.41, 119.65, 34.65] },
  { label: "福建", names: ["福建", "福建省", "闽", "fujian"], bbox: [115.85, 23.53, 120.72, 28.32] },
  { label: "江西", names: ["江西", "江西省", "赣", "jiangxi"], bbox: [113.57, 24.49, 118.48, 30.08] },
  { label: "山东", names: ["山东", "山东省", "鲁", "shandong"], bbox: [114.8, 34.38, 122.72, 38.4] },
  { label: "河南", names: ["河南", "河南省", "豫", "henan"], bbox: [110.21, 31.23, 116.65, 36.37] },
  { label: "湖北", names: ["湖北", "湖北省", "鄂", "hubei"], bbox: [108.21, 29.02, 116.13, 33.27] },
  { label: "湖南", names: ["湖南", "湖南省", "湘", "hunan"], bbox: [108.79, 24.64, 114.25, 30.13] },
  { label: "广东", names: ["广东", "广东省", "粤", "guangdong"], bbox: [109.66, 20.22, 117.32, 25.52] },
  { label: "广西", names: ["广西", "广西壮族自治区", "桂", "guangxi"], bbox: [104.45, 20.9, 112.06, 26.39] },
  { label: "海南", names: ["海南", "海南省", "琼", "hainan"], bbox: [108.56, 18.16, 111.05, 20.1] },
  { label: "重庆", names: ["重庆", "重庆市", "chongqing"], bbox: [105.29, 28.16, 110.2, 32.2] },
  { label: "四川", names: ["四川", "四川省", "川", "蜀", "sichuan"], bbox: [97.35, 26.05, 108.54, 34.32] },
  { label: "贵州", names: ["贵州", "贵州省", "黔", "guizhou"], bbox: [103.6, 24.62, 109.59, 29.22] },
  { label: "云南", names: ["云南", "云南省", "滇", "yunnan"], bbox: [97.53, 21.14, 106.19, 29.22] },
  { label: "西藏", names: ["西藏", "西藏自治区", "藏", "tibet", "xizang"], bbox: [78.4, 26.85, 99.11, 36.48] },
  { label: "陕西", names: ["陕西", "陕西省", "陕", "秦", "shaanxi"], bbox: [105.49, 31.71, 111.24, 39.59] },
  { label: "甘肃", names: ["甘肃", "甘肃省", "甘", "陇", "gansu"], bbox: [92.34, 32.6, 108.71, 42.79] },
  { label: "青海", names: ["青海", "青海省", "青", "qinghai"], bbox: [89.4, 31.6, 103.07, 39.21] },
  { label: "宁夏", names: ["宁夏", "宁夏回族自治区", "宁", "ningxia"], bbox: [104.17, 35.24, 107.65, 39.38] },
  { label: "新疆", names: ["新疆", "新疆维吾尔自治区", "xinjiang"], bbox: [73.5, 34.33, 96.39, 49.18] },
  { label: "台湾", names: ["台湾", "台湾省", "taiwan"], bbox: [119.3, 21.9, 122.0, 25.3] },
  { label: "香港", names: ["香港", "香港特别行政区", "hong kong", "hongkong"], bbox: [113.82, 22.15, 114.5, 22.56] },
  { label: "澳门", names: ["澳门", "澳门特别行政区", "macao", "macau"], bbox: [113.52, 22.1, 113.63, 22.22] },
];

/** zh|en|lon|lat|radiusKm */
const CITY_ROWS = `
北京|Beijing|116.407|39.904|55
天津|Tianjin|117.201|39.084|50
石家庄|Shijiazhuang|114.515|38.042|40
唐山|Tangshan|118.180|39.630|40
秦皇岛|Qinhuangdao|119.600|39.935|35
邯郸|Handan|114.539|36.626|35
保定|Baoding|115.465|38.874|40
张家口|Zhangjiakou|114.886|40.769|40
承德|Chengde|117.963|40.954|40
沧州|Cangzhou|116.839|38.304|35
廊坊|Langfang|116.704|39.538|30
衡水|Hengshui|115.669|37.739|30
太原|Taiyuan|112.549|37.870|40
大同|Datong|113.300|40.077|35
阳泉|Yangquan|113.580|37.857|25
长治|Changzhi|113.117|36.195|35
晋城|Jincheng|112.851|35.491|30
朔州|Shuozhou|112.433|39.331|30
晋中|Jinzhong|112.753|37.687|30
运城|Yuncheng|111.007|35.026|35
忻州|Xinzhou|112.734|38.416|30
临汾|Linfen|111.519|36.088|35
吕梁|Lvliang|111.134|37.519|30
呼和浩特|Hohhot|111.751|40.842|40
包头|Baotou|109.953|40.621|40
赤峰|Chifeng|118.887|42.257|45
通辽|Tongliao|122.263|43.617|40
鄂尔多斯|Ordos|109.781|39.608|50
呼伦贝尔|Hulunbuir|119.766|49.212|70
沈阳|Shenyang|123.431|41.805|45
大连|Dalian|121.615|38.914|40
鞍山|Anshan|122.995|41.108|30
抚顺|Fushun|123.957|41.881|30
本溪|Benxi|123.766|41.294|25
丹东|Dandong|124.383|40.125|30
锦州|Jinzhou|121.127|41.095|30
营口|Yingkou|122.235|40.667|25
阜新|Fuxin|121.670|42.022|30
辽阳|Liaoyang|123.172|41.268|25
盘锦|Panjin|122.071|41.120|25
铁岭|Tieling|123.844|42.290|30
朝阳|Chaoyang|120.451|41.574|30
葫芦岛|Huludao|120.837|40.711|30
长春|Changchun|125.324|43.817|45
吉林市|Jilin|126.549|43.838|40
四平|Siping|124.351|43.166|30
辽源|Liaoyuan|125.144|42.888|25
通化|Tonghua|125.940|41.728|30
白山|Baishan|126.428|41.940|30
松原|Songyuan|124.825|45.141|35
白城|Baicheng|122.839|45.620|30
哈尔滨|Harbin|126.535|45.802|50
齐齐哈尔|Qiqihar|123.918|47.355|40
鸡西|Jixi|130.969|45.295|30
鹤岗|Hegang|130.298|47.350|30
双鸭山|Shuangyashan|131.159|46.643|30
大庆|Daqing|125.104|46.589|40
伊春|Yichun|128.899|47.728|40
佳木斯|Jiamusi|130.319|46.800|35
牡丹江|Mudanjiang|129.633|44.552|35
上海|Shanghai|121.474|31.230|40
南京|Nanjing|118.797|32.060|40
无锡|Wuxi|120.312|31.491|35
徐州|Xuzhou|117.284|34.206|40
常州|Changzhou|119.974|31.811|30
苏州|Suzhou|120.585|31.299|40
南通|Nantong|120.895|31.980|35
连云港|Lianyungang|119.222|34.597|35
淮安|Huaian|119.113|33.551|35
盐城|Yancheng|120.140|33.348|40
扬州|Yangzhou|119.413|32.394|30
镇江|Zhenjiang|119.425|32.188|25
泰州|Taizhou|119.923|32.456|30
宿迁|Suqian|118.275|33.963|30
杭州|Hangzhou|120.155|30.274|50
宁波|Ningbo|121.549|29.868|45
温州|Wenzhou|120.699|28.000|40
嘉兴|Jiaxing|120.755|30.746|30
湖州|Huzhou|120.086|30.894|30
绍兴|Shaoxing|120.582|30.051|30
金华|Jinhua|119.647|29.079|35
衢州|Quzhou|118.859|28.970|30
舟山|Zhoushan|122.207|30.016|30
台州|Taizhou|121.421|28.656|35
丽水|Lishui|119.923|28.452|35
合肥|Hefei|117.227|31.820|40
芜湖|Wuhu|118.376|31.326|30
蚌埠|Bengbu|117.389|32.916|30
淮南|Huainan|117.018|32.625|30
马鞍山|Maanshan|118.507|31.689|25
淮北|Huaibei|116.798|33.956|25
铜陵|Tongling|117.812|30.945|25
安庆|Anqing|117.064|30.543|35
黄山|Huangshan|118.337|29.715|35
滁州|Chuzhou|118.316|32.302|30
阜阳|Fuyang|115.814|32.890|35
宿州|Suzhou|116.964|33.646|30
六安|Luan|116.507|31.753|35
亳州|Bozhou|115.778|33.845|30
池州|Chizhou|117.491|30.665|30
宣城|Xuancheng|118.759|30.941|30
福州|Fuzhou|119.296|26.074|40
厦门|Xiamen|118.089|24.480|30
莆田|Putian|119.008|25.454|25
三明|Sanming|117.639|26.264|30
泉州|Quanzhou|118.676|24.874|35
漳州|Zhangzhou|117.647|24.513|30
南平|Nanping|118.178|26.642|35
龙岩|Longyan|117.017|25.075|35
宁德|Ningde|119.548|26.666|30
南昌|Nanchang|115.858|28.683|40
景德镇|Jingdezhen|117.178|29.269|25
萍乡|Pingxiang|113.852|27.623|25
九江|Jiujiang|116.002|29.705|35
新余|Xinyu|114.917|27.818|25
鹰潭|Yingtan|117.069|28.260|25
赣州|Ganzhou|114.935|25.831|45
吉安|Jian|114.993|27.113|35
宜春|Yichun|114.416|27.816|35
抚州|Fuzhou|116.358|27.949|30
上饶|Shangrao|117.943|28.455|35
济南|Jinan|117.120|36.651|40
青岛|Qingdao|120.383|36.067|40
淄博|Zibo|118.055|36.813|30
枣庄|Zaozhuang|117.324|34.810|30
东营|Dongying|118.675|37.434|30
烟台|Yantai|121.448|37.464|40
潍坊|Weifang|119.162|36.707|40
济宁|Jining|116.587|35.415|35
泰安|Taian|117.088|36.200|30
威海|Weihai|122.121|37.513|30
日照|Rizhao|119.527|35.417|25
临沂|Linyi|118.356|35.105|40
德州|Dezhou|116.357|37.436|30
聊城|Liaocheng|115.985|36.456|30
滨州|Binzhou|118.017|37.383|30
菏泽|Heze|115.481|35.234|35
郑州|Zhengzhou|113.625|34.747|45
开封|Kaifeng|114.307|34.797|30
洛阳|Luoyang|112.454|34.620|40
平顶山|Pingdingshan|113.193|33.766|30
安阳|Anyang|114.392|36.099|30
鹤壁|Hebi|114.297|35.748|25
新乡|Xinxiang|113.927|35.303|30
焦作|Jiaozuo|113.242|35.216|25
濮阳|Puyang|115.029|35.761|25
许昌|Xuchang|113.852|34.037|25
漯河|Luohe|114.017|33.581|25
三门峡|Sanmenxia|111.200|34.773|30
南阳|Nanyang|112.528|32.990|40
商丘|Shangqiu|115.656|34.415|35
信阳|Xinyang|114.091|32.147|35
周口|Zhoukou|114.650|33.620|30
驻马店|Zhumadian|114.023|32.980|30
济源|Jiyuan|112.602|35.067|20
武汉|Wuhan|114.305|30.593|50
黄石|Huangshi|115.039|30.200|25
十堰|Shiyan|110.798|32.629|35
宜昌|Yichang|111.286|30.692|35
襄阳|Xiangyang|112.122|32.009|35
鄂州|Ezhou|114.895|30.391|20
荆门|Jingmen|112.199|31.035|30
孝感|Xiaogan|113.917|30.925|30
荆州|Jingzhou|112.239|30.335|30
黄冈|Huanggang|114.872|30.454|35
咸宁|Xianning|114.323|29.841|30
随州|Suizhou|113.383|31.690|30
恩施|Enshi|109.488|30.272|40
长沙|Changsha|112.939|28.228|40
株洲|Zhuzhou|113.134|27.828|30
湘潭|Xiangtan|112.944|27.830|25
衡阳|Hengyang|112.572|26.893|35
邵阳|Shaoyang|111.468|27.239|35
岳阳|Yueyang|113.129|29.357|30
常德|Changde|111.699|29.032|35
张家界|Zhangjiajie|110.479|29.117|30
益阳|Yiyang|112.355|28.554|30
郴州|Chenzhou|113.015|25.770|35
永州|Yongzhou|111.613|26.420|35
怀化|Huaihua|110.002|27.570|40
娄底|Loudi|111.994|27.700|30
广州|Guangzhou|113.264|23.129|45
韶关|Shaoguan|113.597|24.811|35
深圳|Shenzhen|114.058|22.543|35
珠海|Zhuhai|113.577|22.271|25
汕头|Shantou|116.682|23.354|30
佛山|Foshan|113.122|23.029|30
江门|Jiangmen|113.082|22.579|30
湛江|Zhanjiang|110.359|21.271|35
茂名|Maoming|110.925|21.663|30
肇庆|Zhaoqing|112.465|23.047|30
惠州|Huizhou|114.416|23.112|35
梅州|Meizhou|116.122|24.289|35
汕尾|Shanwei|115.375|22.786|25
河源|Heyuan|114.700|23.744|35
阳江|Yangjiang|111.983|21.859|25
清远|Qingyuan|113.056|23.682|35
东莞|Dongguan|113.752|23.021|30
中山|Zhongshan|113.393|22.516|25
潮州|Chaozhou|116.622|23.657|20
揭阳|Jieyang|116.373|23.550|30
云浮|Yunfu|112.044|22.915|25
南宁|Nanning|108.366|22.817|40
柳州|Liuzhou|109.428|24.326|35
桂林|Guilin|110.290|25.274|40
梧州|Wuzhou|111.279|23.477|25
北海|Beihai|109.120|21.481|25
防城港|Fangchenggang|108.354|21.687|25
钦州|Qinzhou|108.654|21.980|25
贵港|Guigang|109.599|23.112|25
玉林|Yulin|110.181|22.654|30
百色|Baise|106.618|23.902|40
贺州|Hezhou|111.567|24.404|25
河池|Hechi|108.085|24.693|40
来宾|Laibin|109.221|23.750|25
崇左|Chongzuo|107.365|22.377|30
海口|Haikou|110.199|20.044|30
三亚|Sanya|109.512|18.253|30
三沙|Sansha|112.339|16.833|80
儋州|Danzhou|109.581|19.521|30
重庆|Chongqing|106.551|29.563|55
成都|Chengdu|104.066|30.572|50
自贡|Zigong|104.779|29.339|25
攀枝花|Panzhihua|101.719|26.582|30
泸州|Luzhou|105.443|28.872|30
德阳|Deyang|104.398|31.127|25
绵阳|Mianyong|104.679|31.468|35
广元|Guangyuan|105.844|32.435|30
遂宁|Suining|105.593|30.533|25
内江|Neijiang|105.058|29.580|25
乐山|Leshan|103.766|29.552|30
南充|Nanchong|106.111|30.838|30
眉山|Meishan|103.848|30.077|25
宜宾|Yibin|104.643|28.752|30
广安|Guangan|106.633|30.456|25
达州|Dazhou|107.468|31.209|35
雅安|Yaan|103.013|29.981|30
巴中|Bazhong|106.748|31.858|30
资阳|Ziyang|104.628|30.129|25
阿坝|Aba|102.221|31.899|70
甘孜|Garze|101.962|30.049|80
凉山|Liangshan|102.259|27.882|70
贵阳|Guiyang|106.630|26.647|40
六盘水|Liupanshui|104.830|26.593|30
遵义|Zunyi|106.927|27.725|40
安顺|Anshun|105.946|26.253|30
毕节|Bijie|105.285|27.302|40
铜仁|Tongren|109.180|27.719|35
昆明|Kunming|102.833|24.880|45
曲靖|Qujing|103.796|25.490|35
玉溪|Yuxi|102.547|24.352|30
保山|Baoshan|99.162|25.112|35
昭通|Zhaotong|103.717|27.338|35
丽江|Lijiang|100.227|26.855|35
普洱|Puer|100.966|22.825|45
临沧|Lincang|100.087|23.884|35
拉萨|Lhasa|91.140|29.645|40
日喀则|Shigatse|88.880|29.267|50
昌都|Qamdo|97.172|31.141|50
林芝|Nyingchi|94.362|29.649|50
山南|Shannan|91.773|29.237|45
那曲|Nagqu|92.051|31.476|60
阿里|Ngari|80.106|32.501|80
西安|Xian|108.940|34.341|45
铜川|Tongchuan|108.945|34.897|25
宝鸡|Baoji|107.238|34.362|35
咸阳|Xianyang|108.709|34.330|30
渭南|Weinan|109.510|34.500|30
延安|Yanan|109.490|36.585|40
汉中|Hanzhong|107.024|33.068|35
榆林|Yulin|109.735|38.285|45
安康|Ankang|109.029|32.685|35
商洛|Shangluo|109.940|33.868|30
兰州|Lanzhou|103.834|36.061|40
嘉峪关|Jiayuguan|98.289|39.773|25
金昌|Jinchang|102.188|38.520|25
白银|Baiyin|104.173|36.545|30
天水|Tianshui|105.725|34.581|30
武威|Wuwei|102.638|37.928|35
张掖|Zhangye|100.450|38.925|35
平凉|Pingliang|106.665|35.543|30
酒泉|Jiuquan|98.494|39.733|45
庆阳|Qingyang|107.644|35.709|35
定西|Dingxi|104.626|35.581|30
陇南|Longnan|104.922|33.401|35
西宁|Xining|101.778|36.617|35
海东|Haidong|102.104|36.502|30
银川|Yinchuan|106.231|38.487|35
石嘴山|Shizuishan|106.384|39.014|25
吴忠|Wuzhong|106.199|37.997|30
固原|Guyuan|106.243|36.016|30
中卫|Zhongwei|105.197|37.500|30
乌鲁木齐|Urumqi|87.617|43.793|45
克拉玛依|Karamay|84.889|45.580|30
吐鲁番|Turpan|89.190|42.951|40
哈密|Hami|93.515|42.819|45
台北|Taipei|121.565|25.033|30
高雄|Kaohsiung|120.301|22.627|30
台中|Taichung|120.673|24.148|25
香港|Hong Kong|114.170|22.319|25
澳门|Macao|113.543|22.199|12
`.trim();

/** 国外城市：英文检索。en|lon|lat|r|alias;alias */
const WORLD_CITY_ROWS = `
Tokyo|139.692|35.690|55
Osaka|135.502|34.694|45
Seoul|126.978|37.567|50
Pyongyang|125.763|39.039|40
Ulaanbaatar|106.906|47.886|40
Singapore|103.820|1.352|25
Bangkok|100.502|13.756|50
Hanoi|105.834|21.028|40
Ho Chi Minh City|106.630|10.823|45|saigon;ho chi minh
Manila|120.984|14.600|45
Jakarta|106.846|-6.209|50
Kuala Lumpur|101.687|3.139|40
Yangon|96.195|16.866|40
New Delhi|77.209|28.614|50|delhi
Mumbai|72.878|19.076|50|bombay
Kolkata|88.364|22.573|40|calcutta
Dhaka|90.413|23.810|45
Islamabad|73.048|33.684|35
Karachi|67.001|24.861|50
Kabul|69.208|34.555|40
Tehran|51.389|35.689|50
Baghdad|44.366|33.315|40
Riyadh|46.675|24.714|45
Dubai|55.271|25.205|40
Abu Dhabi|54.377|24.454|35
Jerusalem|35.214|31.768|25
Tel Aviv|34.782|32.085|25
Ankara|32.860|39.933|40
Istanbul|28.978|41.008|50
Moscow|37.617|55.756|55
Saint Petersburg|30.335|59.934|45|st petersburg
Kyiv|30.523|50.450|40|kiev
Warsaw|21.012|52.230|40
Berlin|13.405|52.520|45
Paris|2.352|48.857|45
London|-0.128|51.507|50
Madrid|-3.704|40.417|40
Rome|12.496|41.903|40
Athens|23.728|37.984|35
Vienna|16.374|48.208|35
Amsterdam|4.904|52.368|35
Brussels|4.352|50.850|30
Stockholm|18.069|59.329|35
Oslo|10.752|59.914|30
Helsinki|24.938|60.170|30
Copenhagen|12.568|55.676|30
Zurich|8.542|47.377|25
Prague|14.438|50.076|30
Budapest|19.040|47.498|30
Bucharest|26.103|44.427|30
Belgrade|20.449|44.787|30
Cairo|31.236|30.044|50
Lagos|3.379|6.524|50
Nairobi|36.822|-1.292|40
Addis Ababa|38.758|9.032|40
Johannesburg|28.047|-26.204|45
Cape Town|18.424|-33.925|40
Casablanca|-7.590|33.573|35
Algiers|3.059|36.754|35
Tripoli|13.191|32.887|30
Khartoum|32.560|15.501|40
New York|-74.006|40.713|55|nyc;new york city
Washington|-77.037|38.907|35|washington dc;washington d.c.
Los Angeles|-118.244|34.052|55|la
Chicago|-87.630|41.878|50
San Francisco|-122.419|37.775|40
Houston|-95.370|29.760|45
Toronto|-79.383|43.653|45
Vancouver|-123.121|49.283|40
Mexico City|-99.133|19.433|55
Havana|-82.367|23.114|30
Bogota|-74.072|4.711|45
Lima|-77.043|-12.046|45
Santiago|-70.669|-33.449|40
Buenos Aires|-58.382|-34.604|50
Sao Paulo|-46.633|-23.551|55|são paulo
Rio de Janeiro|-43.173|-22.907|45
Brasilia|-47.883|-15.794|35
Caracas|-66.904|10.481|35
Quito|-78.468|-0.181|30
Sydney|151.209|-33.869|45
Melbourne|144.963|-37.814|45
Canberra|149.130|-35.281|25
Auckland|174.763|-36.849|40
Wellington|174.776|-41.287|25
Tashkent|69.240|41.300|40
Astana|71.470|51.161|35
Almaty|76.851|43.222|35
Bishkek|74.570|42.875|30
Tbilisi|44.827|41.715|30
Yerevan|44.515|40.187|25
Baku|49.867|40.409|35
Damascus|36.277|33.514|30
Beirut|35.502|33.894|20
Amman|35.911|31.954|25
Kuwait City|47.977|29.376|25
Doha|51.531|25.285|25
Sanaa|44.207|15.369|30
Mogadishu|45.318|2.047|35
Kinshasa|15.266|-4.442|45
Accra|-0.187|5.604|30
Dakar|-17.447|14.717|30
Abidjan|-4.008|5.360|40
Port-au-Prince|-72.307|18.594|25
Panama City|-79.520|8.982|25
Guatemala City|-90.507|14.635|25
Lisbon|-9.140|38.722|30
Dublin|-6.260|53.350|30
Edinburgh|-3.188|55.953|25
Manchester|-2.243|53.480|30
Barcelona|2.173|41.385|35
Milan|9.190|45.464|35
Munich|11.582|48.135|35
Hamburg|9.993|53.551|35
Frankfurt|8.682|50.111|30
Geneva|6.143|46.204|20
Kyoto|135.768|35.012|30
Nagoya|136.906|35.181|35
Fukuoka|130.402|33.590|30
Sapporo|141.355|43.062|35
Busan|129.076|35.180|35
Taipei|121.565|25.033|30
`.trim();

function parseCities() {
  return CITY_ROWS.split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [zh, en, lon, lat, r] = line.split("|");
      return {
        kind: "city",
        locale: "zh",
        label: zh,
        names: [zh, `${zh}市`, en, en && en.toLowerCase()].filter(Boolean),
        lon: Number(lon),
        lat: Number(lat),
        radiusKm: Number(r) || 40,
      };
    });
}

function parseWorldCities() {
  return WORLD_CITY_ROWS.split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [en, lon, lat, r, aliases] = line.split("|");
      const extra = (aliases || "")
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean);
      const names = [en, en.toLowerCase(), ...extra, ...extra.map((a) => a.toLowerCase())];
      return {
        kind: "city",
        locale: "en",
        label: en,
        names: [...new Set(names)],
        lon: Number(lon),
        lat: Number(lat),
        radiusKm: Number(r) || 40,
      };
    });
}

const CITIES = parseCities().concat(parseWorldCities());
const extraPlaces = [];

function norm(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[省市区县]$/g, "")
    .replace(/(壮族|回族|维吾尔)?自治区$/g, "")
    .replace(/特别行政区$/g, "");
}

function nameMatches(names, token) {
  const t = String(token || "").trim().toLowerCase();
  const n = norm(token);
  if (!t) return false;
  return names.some((name) => {
    const ln = String(name).toLowerCase();
    if (ln === t) return true;
    return n.length >= 2 && norm(name) === n;
  });
}

function distKm(lon1, lat1, lon2, lat2) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

function allCities() {
  return extraPlaces.length ? CITIES.concat(extraPlaces) : CITIES;
}

function allPlaces() {
  return CITIES.concat(extraPlaces, PROVINCES.map((p) => ({ ...p, kind: "province" })));
}

export function registerExtraPlaces(items) {
  extraPlaces.length = 0;
  for (const it of items || []) {
    if (!it || !it.label || !Number.isFinite(it.lon) || !Number.isFinite(it.lat)) continue;
    extraPlaces.push({
      kind: "city",
      label: it.label,
      names: it.names && it.names.length ? it.names : [it.label],
      lon: it.lon,
      lat: it.lat,
      radiusKm: it.radiusKm || 55,
    });
  }
}

export function findRegions(token) {
  return allPlaces().filter((r) => nameMatches(r.names, token));
}

export function pointInBbox(lon, lat, bbox) {
  const [w, s, e, n] = bbox;
  return lon >= w && lon <= e && lat >= s && lat <= n;
}

function placeContains(place, lon, lat) {
  if (place.bbox) return pointInBbox(lon, lat, place.bbox);
  if (Number.isFinite(place.lon) && Number.isFinite(place.lat)) {
    return distKm(lon, lat, place.lon, place.lat) <= (place.radiusKm || 40);
  }
  return false;
}

export function pointMatchesPlaceToken(lon, lat, token) {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return false;
  return findRegions(token).some((r) => placeContains(r, lon, lat));
}

export function primaryPlace(token) {
  const regs = findRegions(token);
  return regs.find((r) => r.kind === "city") || regs[0] || null;
}

/** 支持 New York / Ho Chi Minh 这种多词英文市名 */
export function resolvePlaceFromValues(values) {
  const vals = (values || []).map((v) => String(v || "").trim()).filter(Boolean);
  const combos = [];
  for (let i = 0; i < vals.length; i++) {
    combos.push(vals[i]);
    if (i + 1 < vals.length) combos.push(`${vals[i]} ${vals[i + 1]}`);
    if (i + 2 < vals.length) combos.push(`${vals[i]} ${vals[i + 1]} ${vals[i + 2]}`);
  }
  combos.sort((a, b) => b.length - a.length);
  for (const c of combos) {
    const hit = primaryPlace(c);
    if (hit) return hit;
  }
  return null;
}

export function placeBounds(place) {
  if (!place) return null;
  if (place.bbox && place.bbox.length === 4) return place.bbox;
  if (Number.isFinite(place.lon) && Number.isFinite(place.lat)) {
    const d = Math.max(0.35, (place.radiusKm || 40) / 95);
    return [place.lon - d, place.lat - d * 0.85, place.lon + d, place.lat + d * 0.85];
  }
  return null;
}

export function getCityLabelCollection() {
  const seen = new Set();
  const features = [];
  for (const c of allCities()) {
    if (!Number.isFinite(c.lon) || !Number.isFinite(c.lat)) continue;
    const key = `${c.lon.toFixed(2)},${c.lat.toFixed(2)}`;
    if (seen.has(c.label) || seen.has(key)) continue;
    seen.add(c.label);
    seen.add(key);
    const en = (c.names || []).find((n) => /^[A-Za-z]/.test(String(n)));
    const isEn = c.locale === "en";
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [c.lon, c.lat] },
      properties: {
        kind: "city",
        name_zh: isEn ? "" : c.label,
        name_en: en || c.label,
        rank: (c.radiusKm || 40) >= 45 ? 1 : 2,
      },
    });
  }
  return { type: "FeatureCollection", features };
}

/** 把落在该点的省/市名称做成可搜索关键字 */
export function placesAt(lon, lat) {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    return { hits: [], keywords: "", label: "" };
  }
  const hits = allPlaces().filter((r) => placeContains(r, lon, lat));
  const names = [];
  for (const h of hits) {
    names.push(h.label, ...(h.names || []));
  }
  const keywords = [...new Set(names.filter(Boolean))].join(" ");
  const city = hits.find((h) => h.kind === "city");
  return { hits, keywords, label: (city || hits[0] || {}).label || "" };
}
