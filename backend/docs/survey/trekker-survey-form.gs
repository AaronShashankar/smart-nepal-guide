/**
 * Bato: builds the trekker survey as a Google Form, with a linked response sheet.
 *
 * How to use (once):
 *   1. Open https://script.google.com and click "New project".
 *   2. Delete the sample code, paste this whole file, and click Save.
 *   3. Choose the function "createTrekkerSurvey" at the top and click Run.
 *      Google asks for permission the first time: Review permissions -> your account ->
 *      Advanced -> Go to project (unsafe) -> Allow. It is your own script.
 *   4. Open "Execution log" at the bottom: it prints the link to share and the edit link.
 *
 * IMPORTANT: do not reorder the questions or rename the answer options. The import script
 * (backend/app/ml/dataset.py, survey_rows) reads the CSV columns by position and matches
 * the answers by their text (for example "EBC", "Jan", "None", "Severe", "Turned back").
 * Questions are in the same order as backend/docs/survey/trekker-survey.md.
 */
function createTrekkerSurvey() {
  var form = FormApp.create('Trekking in Nepal: how hard was it?');
  form
    .setDescription(
      'Bato is a student project (BCA, Tribhuvan University) that predicts how hard and risky a ' +
        'trek in Nepal is for a particular person. Your answers help train that model.\n\n' +
        'Answer about ONE trek you have completed. If you did more than one, you can fill in the ' +
        'form again for each trek.\n\n' +
        'The form is anonymous: we do not collect your name or email. Answers are used only for ' +
        'this student project. It takes about 2 minutes.'
    )
    .setCollectEmail(false)
    .setLimitOneResponsePerUser(false) // true would force respondents to sign in
    .setAllowResponseEdits(false)
    .setShowLinkToRespondAgain(true)
    .setProgressBar(false)
    .setConfirmationMessage(
      'Thank you! Your answer was saved. Did another trek? Use the link below to answer again.'
    );

  // 1. Trek (the text must contain the short name the import script looks for)
  var trek = form.addMultipleChoiceItem();
  trek
    .setTitle('Which trek did you do?')
    .setChoiceValues([
      'Poon Hill',
      'Annapurna Base Camp (ABC)',
      'Everest Base Camp (EBC)',
      'Langtang Valley',
      'Mardi Himal',
      'Annapurna Circuit',
      'Gosaikunda',
      'Manaslu Circuit',
    ])
    .showOtherOption(true)
    .setRequired(true);

  // 2. Days
  form
    .addTextItem()
    .setTitle('How many days did the trek take you?')
    .setHelpText('Walking days from the trailhead and back, including rest days. Example: 12')
    .setValidation(wholeNumber('^[1-9][0-9]?$', 'Enter a number of days, for example 12'))
    .setRequired(true);

  // 3. Month (the import script reads the first 3 letters)
  form
    .addListItem()
    .setTitle('In which month did you start?')
    .setChoiceValues([
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ])
    .setRequired(true);

  // 4. Age
  form
    .addTextItem()
    .setTitle('Your age at the time of the trek')
    .setValidation(wholeNumber('^[1-9][0-9]$', 'Enter your age in years, for example 27'))
    .setRequired(true);

  // 5. Fitness (options must stay exactly Low / Medium / High)
  form
    .addMultipleChoiceItem()
    .setTitle('Your fitness level at that time')
    .setHelpText(
      'Low: rarely exercised. Medium: exercised or walked a lot every week. ' +
        'High: regular running, hiking or sport.'
    )
    .setChoiceValues(['Low', 'Medium', 'High'])
    .setRequired(true);

  // 6. Experience (must start with "None", "1" or "3")
  form
    .addMultipleChoiceItem()
    .setTitle('How many multi-day treks had you done BEFORE this one?')
    .setChoiceValues(['None (this was my first)', '1–2', '3 or more'])
    .setRequired(true);

  // 7. Health
  form
    .addMultipleChoiceItem()
    .setTitle('Did you have a heart or lung condition at the time (for example asthma)?')
    .setChoiceValues(['Yes', 'No', 'Prefer not to say'])
    .setRequired(true);

  // 8. Rest days (kept for checking; not used by the model)
  form
    .addTextItem()
    .setTitle('How many rest / acclimatisation days did you take?')
    .setHelpText('Days when you did not move to a higher place. Enter 0 if none.')
    .setValidation(wholeNumber('^[0-9]{1,2}$', 'Enter a number, for example 2 (or 0)'))
    .setRequired(true);

  // 9. Symptoms (must start with None / Mild / Strong / Severe)
  form
    .addMultipleChoiceItem()
    .setTitle('Did you get altitude sickness symptoms?')
    .setChoiceValues([
      'None',
      'Mild (headache)',
      'Strong (had to rest)',
      'Severe (had to descend or be evacuated)',
    ])
    .setRequired(true);

  // 10. Difficulty: this is the label (first word must be Easy / Moderate / Hard / Risky)
  form
    .addMultipleChoiceItem()
    .setTitle('Overall, how hard was the trek FOR YOU?')
    .setChoiceValues(['Easy', 'Moderate', 'Hard', 'Risky (unsafe for me)'])
    .setRequired(true);

  // 11. Finished (must start with Yes / Changed / Turned back)
  form
    .addMultipleChoiceItem()
    .setTitle('Did you finish the trek as planned?')
    .setChoiceValues(['Yes', 'Changed plan', 'Turned back'])
    .setRequired(true);

  // Response sheet (File -> Download -> CSV from here gives backend/survey.csv)
  var sheet = SpreadsheetApp.create('Trekking in Nepal: how hard was it? (Responses)');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());

  // Newer Google Forms can start unpublished; publish it so anyone with the link can answer.
  if (typeof form.setPublished === 'function') form.setPublished(true);
  form.setAcceptingResponses(true);

  var link = form.getPublishedUrl();
  var shortLink = link;
  try {
    shortLink = form.shortenFormUrl(link);
  } catch (e) {
    // the long link works too
  }

  Logger.log('SHARE THIS LINK:   ' + shortLink);
  Logger.log('Full link:         ' + link);
  Logger.log('Edit the form:     ' + form.getEditUrl());
  Logger.log('Responses sheet:   ' + sheet.getUrl());
}

function wholeNumber(pattern, message) {
  return FormApp.createTextValidation()
    .setHelpText(message)
    .requireTextMatchesPattern(pattern)
    .build();
}
