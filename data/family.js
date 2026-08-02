// SINGLE SOURCE OF TRUTH for family data.
//
// Why a .js file and not a .json file?
// Browsers block fetch()/XHR/ES-module imports of local files when the app is
// opened via file:// (double-click) in Chrome, Safari and Edge (CORS). Loading
// this data through <script src> is the ONLY method that works across all
// browsers with no server. The object below is PURE JSON; edit it like JSON.
//
// To get a clean .json file, use the "Download .json" action in the app.

window.FAMILY_DATA =
{
  "people": [
    {
      "id": "1001",
      "first_name": "Robert",
      "middle_name": "James",
      "last_name": "Carter",
      "gender": "male",
      "dob": "1948-03-12",
      "birth_country": "United States",
      "ancestors": [],
      "children": ["2001", "2002"],
      "spouses": [
        {
          "id": "1002",
          "date": "1971-06-19"
        }
      ]
    },
    {
      "id": "1002",
      "first_name": "Helen",
      "middle_name": "Marie",
      "last_name": "Carter",
      "gender": "female",
      "dob": "1950-09-27",
      "birth_country": "United States",
      "ancestors": [],
      "children": ["2001", "2002"],
      "spouses": [
        {
          "id": "1001",
          "date": "1971-06-19"
        }
      ]
    },
    {
      "id": "2001",
      "first_name": "Michael",
      "middle_name": "Andrew",
      "last_name": "Carter",
      "gender": "male",
      "dob": "1976-01-08",
      "birth_country": "United States",
      "ancestors": ["1001", "1002"],
      "children": ["3001", "3002"],
      "spouses": [
        {
          "id": "2003",
          "date": "2002-04-13"
        }
      ]
    },
    {
      "id": "2002",
      "first_name": "Laura",
      "middle_name": "Anne",
      "last_name": "Carter",
      "gender": "female",
      "dob": "1979-11-21",
      "birth_country": "United States",
      "ancestors": ["1001", "1002"],
      "children": [],
      "spouses": []
    },
    {
      "id": "2003",
      "first_name": "Sofia",
      "middle_name": "Elena",
      "last_name": "Martinez",
      "gender": "female",
      "dob": "1978-07-14",
      "birth_country": "Mexico",
      "ancestors": [],
      "children": ["3001", "3002"],
      "spouses": [
        {
          "id": "2001",
          "date": "2002-04-13"
        }
      ]
    },
    {
      "id": "3001",
      "first_name": "Emma",
      "middle_name": "Rose",
      "last_name": "Carter",
      "gender": "female",
      "dob": "2006-05-03",
      "birth_country": "United States",
      "ancestors": ["1001", "1002", "2001", "2003"],
      "children": [],
      "spouses": []
    },
    {
      "id": "3002",
      "first_name": "Noah",
      "middle_name": "Daniel",
      "last_name": "Carter",
      "gender": "male",
      "dob": "2009-10-18",
      "birth_country": "United States",
      "ancestors": ["1001", "1002", "2001", "2003"],
      "children": [],
      "spouses": []
    }
  ]
};
