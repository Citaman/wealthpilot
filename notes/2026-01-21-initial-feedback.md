# Initial feedback / backlog notes (2026-01-21)

Ok thanks for this first version of the app , i will call it a v0.0.1 and not 1.0 because we are no where near the stable all working no bugs or feature proof version but a good start.
I will now try to explain in much or less detail each thunigs not working properly or that shoudl eb added or removed or else ,as before as this is a farily large feedback i want forst you to understand see test analysis and stratetise and plan before doing anything and confirm with me also with all the thing that i will tell you give a fairly amount of suggestion

- First thing the README is the nextJs native i want a proper READ ME with the Feature , the WIP and the Roadmap of future version and all

- One things that i really want is 2 definition of months, the normal calendar ways with 1s a the start of the months and the 31/30/... as the end, and a more accurate finacial months where the months start when i receive ma salary and every things is calcualted around this the saving buget and all the other things in the app. The later shoudl be the default and in the settings I can change to the normal months

-In the dashboard the dropdown range month sletor is not doing anythin and maybethis a to high level mabe erase this one and make it on per page if its necessary only for intentional usage and well placed

- In the dashboard The current balance is 0 , this is a problem and the other number also are not right , the problem i think is the hanle of the 2 type of csv and a so value, this should reflect of the current balance and not only really on the csv , so in this i want to say that the csv are the data but the current number of the app should be calculated adn verified and all so the balance is not from the csv but from the calculation on the app based on the csv
- in this same problem the csv from the pdf that as been created by an other llm is not the same format as the csv for the future imports but it should match durring couple of months , the historical csv is from Decemebr 2024 to decemeb 2025 (the 23 of the months if im correct) and the imports nowis from September 2025 to Janurary 2026 (to 16/01/2026) so there is 4 months that should be dupicated and all , but for now the app doest take care of this , so when an csv is important if there is a collision of months the import data is prioritary but it doet mean to wipe the history but more look for the same line and keep only the latest line , there my be some modifcatio on the historical of data (expcept the amout) but maybe splitt or something like this so it shoudl also take this into accout. Also there is a lot of line that is a little bit differnet form the historical data and the one import after like
`10/12/2025 10/12/2025 PRELEVEMENT EUROPEEN 7026904072                                       19,21` from the historical data and
`PRELEVEMENT EUROPEEN 7026904072 DE: papernest ID: FR55ZZZ671230 MOTIF: PNEST CONTRAT MRHPN105  LC01-122025              -19,21` on the import csv this is the same transaction but in the app this is count Twice
TLDR; for this point the csv histicall there is a lot of tiny mistake and all please review it and simplify it and make it more close to the import csv , do some analisys on the 2 and test your hypotesti on the period they sharded to find a perfect way to handle this and also to improve the import csv and the follow up

- In the dashboard the left side panel is not following the page so when i scroll it stay up and i can see an end so please make that the side panel follow the scrool or stick or i dont know

- In the dashbord , the Cash flow overview is not that intersting and du to earlier proble of the select range i can see other temporality, make it more lie the image_2 with the bar hsort with up is the income and down is the expense, this can be view for the last 3 month the last month , the lats 6 months , last 12 month , all history.

- In the dashboard the spending by category is to random plot, be more like the image_1 with the summary with multiple circular chart to see the amout spend compare to the bugets goals and make that it can be more than 100% by making the 101% and other doing an other round with more darker color and all

- in the dash board I would like a 1 week view calendar in horirontal, so i can view my incoming spend if there is any and in the past i can see what is already taking into account , i can go to futher week one week a time or inverse see the past .

- The Recent transaction is good in the dashboard , still the balance prensent should be calculated and not took on the csv and all

- In the dashboard There is a `finacial Insight` Where nothing is shown i want a something here , please think really hard to see some algorithm than can be added here to give some advice and all , not like 2 or 3 advice but really good advice than can change and there could be a lot of possibile insight and all maybe bigest spend ,a actional things, reminders , things from other tabs , like subscription that are useless and all , budget that can be improved, transaction that can be insigth full  and other things.

- In trasaction tab , i shoud be able to edit each and evry line for every data point and also, there should be a part where i can change the categories, update the name of categorues, remove categories or sub categories, and if i update a transaction categrories , a search is done to see if there can be otehr transaction that can be change accordingly also. maybe also suggestion of switching categories.

- In the transaction as for the categories, i should be able to change the marchand name or see the detail of the full data also and change accordingly and same as the category when i change there is suggestion of potential successive change accordingly (but everything should be ultra fast and works every time)

- The change of categories or information like name if the marchand should be saved and all, for futures imports to base of that the name categories and all

- The Analitics is realy weirds , its like too close to the dashboard and the line charts like the dashboard is not that informative, This should have a clear revamp to be use full have important functionality that can be usefull for the user to manage the spend see the trends and all , a intereing charts is the balance in a months or compared to the 12/6/3 previous months, this one could be a line chart and all to see the time it take to rach the lowest before the start of the other months. Add other plot and charts and things but that can be usefull and not like a dribbble image to showoff but to be usefull , but still Perfect UI and UX

- For the Bugget i should be able to change the definition of wants need and savings base on my goals and other things , think about real user need when a user want to manage its finance.

- For the subscruption I should be able to see what is the basis of the detection of this bills , see in a charts the time all the transaction as been hit my account and all , (this functionnalty should be also in analitics to target the recurrent billas and all) ,  The subscrption inclued also things like loan and obligation and credit and all and so its not really every things subscirption so i know there can be improvemnt in ux and all for this. Mabe also when i click on the subcsutpti i can see the calendar only for this "subscuroptino" to see when its been taken.

- In the subscruption if i put a transaction as not a subscruption or loan or else it should be save for the future imports to not be inside and all

- For the subsciption also i should be able to add mising recurrent transaction base on the save transaction and not a made up one , and so choosing the transaction and all.

- For the subscription also i should see the ones that are ended , or canceld (differend to erase), so see finish loans and all, maybe add a section credit loan and add to the dahboard  panel with this information , about an amount the user can put as the total and see the progression and all

- In the analitics add the possibility to see the future expense with the subscrubtuion and all and some also predicted expense base on the data using Statistical model like SARIMA Prophet or better model to have some prediction insgint

- In the analitucs also and maybe also in the dashboard to the in the month the amount of predicted expense and the variable expense and all

- For the Bill calendar add the future bills in the calendar and base on the previous time the expense hit , put the date accordingly ,

- would like also a calendar but more in a day to day expense , income and all to how much i spend per day and i can see trend and all, and i can change the view to weeks or months and all and when i click on a date like the bill calendar i see a more detail information about the transaction and maybe think of better showing this or improve my idea

- FOR each line i gave some instruction maybe there is better imporvemnt more bold and really great think of it and improve accordingly

- For the accout and the import data , ask the user to put for each account this import is

- Prepare the app to have multiple account , ill add soon my other bank account and all , this is not for login but for a more broad use of my accound and all
