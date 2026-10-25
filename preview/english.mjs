// Localized screenshot preview only. Does not change the shipped plugin's language.
export const english={
 '我的电脑':'My computer','游戏模组 · 本地修改':'Game mods · Local changes',
 '已连接':'Connected','执行中':'Running','等待回复':'Waiting for reply','执行异常':'Agent error','保存的会话':'Saved conversation','连接异常':'Connection error','连接中':'Connecting',
 '说话 / 发送':'Talk / Send','结束并发送':'Stop & send','结束并预览':'Stop & preview','正在识别…':'Transcribing…','正在发送…':'Sending…','发送识别文字':'Send transcript',
 '正在听 · 结束后发送':'Listening · Stop to send','正在听 · 结束后预览文字':'Listening · Stop to preview',
 '按住 R4 说话 · 松开发送':'Hold R4 to talk · Release to send','按住 R4 说话 · 松开预览':'Hold R4 to talk · Release to preview',
 '点按钮说话，再点一次发送':'Tap to talk; tap again to send','正在识别普通话…':'Transcribing Mandarin…','Agent 正在执行…':'Agent is working…',
 '正在识别你的语音…':'Transcribing your voice…','取消录音':'Cancel recording','放弃这段文字':'Discard transcript','识别文字':'Transcript','你':'You',
 '切换会话与设置':'Conversations & settings','回到聊天':'Back to chat','＋ 添加执行机器':'+ Add computer','取消添加':'Cancel adding computer',
 '机器名称':'Computer name','Bridge 地址':'Bridge URL','连接令牌':'Pairing token','连接并保存':'Connect & save','机器':'Computer','Agent':'Agent','会话':'Conversation','请选择会话':'Choose a conversation',
 '新建会话并开始聊天':'New conversation','编辑当前机器':'Edit computer','移除当前机器':'Remove computer','松开后自动发送':'Send automatically on release','说话背键':'Push-to-talk button','关闭背键':'Disable rear button',
 '移除此机器？':'Remove this computer?','只移除 Deck 上的连接配置，不影响远端会话。':'Remove this Deck connection only. Remote conversations remain.','移除':'Remove','关闭':'Close',
 '重试连接':'Retry connection','↑ 更早消息':'↑ Earlier messages','有新回复 · 回到最新':'New reply · Jump to latest','正在读取…':'Loading…','还没有消息，直接说话开始。':'No messages yet. Talk to start.',
 '正在读取聊天…':'Loading conversation…','正在读取会话…':'Loading conversations…','添加执行机器':'Add computer','先添加执行机器，支持局域网或 Tailscale。':'Add a computer over LAN or an optional VPN.',
 '点上方选择会话，之后打开直接看回复。':'Choose a conversation above. Next time, open directly to replies.',
};
export const tr=value=>typeof value==='string'?(english[value]??value):value;
